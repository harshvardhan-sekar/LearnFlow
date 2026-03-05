"""Hints router — progressive 3-level hint generation via SSE streaming."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from engines.hint_engine import generate_hint
from models.concept import ConceptNode
from models.database import get_db
from models.test_record import QuestionResult, TestRecord
from models.user import User
from utils.dependencies import get_current_user

router = APIRouter(prefix="/api/hints", tags=["hints"])


# ── Schema ────────────────────────────────────────────────────────────────


class HintRequest(BaseModel):
    question_id: int
    concept_key: str
    level: int = Field(ge=1, le=3)


# ── Route ─────────────────────────────────────────────────────────────────


@router.post("")
async def request_hint(
    body: HintRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream a progressive hint for a test question via SSE.

    Verifies ownership, loads question and concept metadata, increments
    hints_used on the QuestionResult, then streams a level-appropriate
    hint from the hint engine.

    Hint levels:
    - 1: nudge — subtle direction without revealing the answer
    - 2: concept — explains the relevant concept
    - 3: steps — full step-by-step walkthrough
    """
    # Load question and verify ownership via parent TestRecord
    qr_result = await db.execute(
        select(QuestionResult).where(QuestionResult.id == body.question_id)
    )
    question = qr_result.scalar_one_or_none()
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found")

    tr_result = await db.execute(
        select(TestRecord).where(
            TestRecord.id == question.test_record_id,
            TestRecord.user_id == user.id,
        )
    )
    if tr_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=403, detail="Not your question")

    # Resolve concept metadata
    concept_name = body.concept_key
    concept_description = ""
    ideal_answer = question.ideal_answer or ""

    if question.concept_node_id is not None:
        node_result = await db.execute(
            select(ConceptNode).where(ConceptNode.id == question.concept_node_id)
        )
        node = node_result.scalar_one_or_none()
        if node is not None:
            concept_name = node.name
            concept_description = node.description or ""
    else:
        # Fallback: look up by concept_key string
        node_result = await db.execute(
            select(ConceptNode).where(ConceptNode.key == body.concept_key)
        )
        node = node_result.scalar_one_or_none()
        if node is not None:
            concept_name = node.name
            concept_description = node.description or ""

    # Increment hints_used
    question.hints_used = (question.hints_used or 0) + 1
    await db.commit()

    # Stream hint response
    async def event_stream():
        try:
            async for delta in generate_hint(
                question_text=question.question_text,
                concept_name=concept_name,
                concept_description=concept_description,
                ideal_answer=ideal_answer,
                level=body.level,
            ):
                if delta.startswith("\n__USAGE__"):
                    continue
                yield f"data: {json.dumps({'content': delta})}\n\n"
        except ValueError as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        except Exception:
            yield f"data: {json.dumps({'error': 'Hint generation failed'})}\n\n"

        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
