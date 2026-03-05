"""Chat router — streaming SSE chat and history retrieval."""

from __future__ import annotations

import json
import time
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.concept import ConceptGraph, ConceptNode
from models.database import get_db
from models.event import ChatEvent
from models.mastery import MasteryState
from models.session import Session
from models.subgoal import Subgoal
from models.topic import LearningTopic
from models.user import User
from services.llm_client import stream_completion
from utils.dependencies import get_current_user
from utils.prompts import build_chat_system_prompt

router = APIRouter(prefix="/api/chat", tags=["chat"])


# ── Schemas ──────────────────────────────────────────────────────────────


class ChatRequest(BaseModel):
    message: str
    session_id: int
    topic_id: int


class ChatEventResponse(BaseModel):
    id: int
    session_id: int
    role: str
    content: str
    tokens_used: int | None
    response_time_ms: int | None
    template_type: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Helpers ──────────────────────────────────────────────────────────────


async def _get_active_session_or_400(
    session_id: int, user: User, db: AsyncSession
) -> Session:
    """Validate that the session exists, belongs to the user, and is active."""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your session")
    if session.status not in ("active", "paused"):
        raise HTTPException(status_code=400, detail="Session is not active")
    return session


# ── Routes ───────────────────────────────────────────────────────────────


@router.post("/")
async def send_chat_message(
    body: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream a chat response via SSE.

    1. Validates session ownership and status.
    2. Builds a dynamic system prompt from the topic + subgoals.
    3. Loads chat history from this session for context.
    4. Logs the user message, streams the assistant response, then logs it.
    """
    session = await _get_active_session_or_400(body.session_id, user, db)

    # ── Fetch topic title ────────────────────────────────────────────
    topic_result = await db.execute(
        select(LearningTopic).where(LearningTopic.id == body.topic_id)
    )
    topic = topic_result.scalar_one_or_none()
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")

    # ── Fetch subgoals for this topic ────────────────────────────────
    sg_result = await db.execute(
        select(Subgoal)
        .where(Subgoal.topic_id == body.topic_id)
        .order_by(Subgoal.sort_order)
    )
    subgoals = [
        {
            "title": sg.title,
            "is_completed": sg.is_completed,
            "sort_order": sg.sort_order,
        }
        for sg in sg_result.scalars().all()
    ]

    # ── Fetch mastery states for this topic (if a concept graph exists) ──
    mastery_states = None
    graph_result = await db.execute(
        select(ConceptGraph).where(ConceptGraph.topic_id == body.topic_id)
    )
    graph = graph_result.scalar_one_or_none()
    if graph is not None:
        nodes_result = await db.execute(
            select(ConceptNode).where(ConceptNode.graph_id == graph.id)
        )
        nodes = nodes_result.scalars().all()
        if nodes:
            node_id_to_name = {n.id: n.name for n in nodes}
            ms_result = await db.execute(
                select(MasteryState).where(
                    MasteryState.user_id == user.id,
                    MasteryState.concept_node_id.in_(list(node_id_to_name.keys())),
                )
            )
            states = ms_result.scalars().all()
            if states:
                mastery_states = [
                    {
                        "concept_name": node_id_to_name[ms.concept_node_id],
                        "mastery_score": ms.mastery_score,
                    }
                    for ms in states
                ]

    system_prompt = build_chat_system_prompt(topic.title, subgoals, mastery_states)

    # ── Build message history from this session ──────────────────────
    history_result = await db.execute(
        select(ChatEvent)
        .where(ChatEvent.session_id == body.session_id)
        .order_by(ChatEvent.created_at)
    )
    messages: list[dict[str, str]] = [
        {"role": evt.role, "content": evt.content}
        for evt in history_result.scalars().all()
    ]
    messages.append({"role": "user", "content": body.message})

    # ── Log user message ─────────────────────────────────────────────
    user_event = ChatEvent(
        session_id=body.session_id,
        user_id=user.id,
        role="user",
        content=body.message,
    )
    db.add(user_event)
    await db.commit()

    # ── Stream assistant response ────────────────────────────────────
    start_time = time.monotonic()

    async def event_stream():
        full_content = ""
        tokens_used = None

        try:
            async for delta in stream_completion(messages, system_prompt=system_prompt):
                # Check for usage metadata appended by llm_client
                if delta.startswith("\n__USAGE__"):
                    usage_data = json.loads(delta.removeprefix("\n__USAGE__"))
                    tokens_used = usage_data.get("total_tokens")
                    continue

                full_content += delta
                yield f"data: {json.dumps({'content': delta})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

        # Signal end of stream
        elapsed_ms = int((time.monotonic() - start_time) * 1000)
        yield f"data: {json.dumps({'done': True, 'tokens_used': tokens_used, 'response_time_ms': elapsed_ms})}\n\n"

        # Log assistant message (use a fresh session to avoid closed-session issues)
        from models.database import async_session

        async with async_session() as log_db:
            assistant_event = ChatEvent(
                session_id=body.session_id,
                user_id=user.id,
                role="assistant",
                content=full_content,
                tokens_used=tokens_used,
                response_time_ms=elapsed_ms,
            )
            log_db.add(assistant_event)
            await log_db.commit()

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/history/{session_id}", response_model=list[ChatEventResponse])
async def get_chat_history(
    session_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all chat events for a session, ordered chronologically."""
    # Verify session ownership
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your session")

    events_result = await db.execute(
        select(ChatEvent)
        .where(ChatEvent.session_id == session_id)
        .order_by(ChatEvent.created_at)
    )
    return events_result.scalars().all()
