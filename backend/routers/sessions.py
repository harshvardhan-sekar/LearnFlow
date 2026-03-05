"""Sessions router — start, end, pause, resume, list, state, export."""

import logging
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from engines.concept_extractor import extract_concept_graph
from models.concept import ConceptGraph, ConceptNode
from models.database import get_db, async_session as async_session_maker
from models.session import Session
from models.topic import LearningTopic
from models.user import User
from utils.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


# ── Schemas ──────────────────────────────────────────────────────────────

class SessionCreate(BaseModel):
    topic_id: int


class SessionStateUpdate(BaseModel):
    session_state: dict


class SessionResponse(BaseModel):
    id: int
    user_id: int | None
    topic_id: int | None
    status: str
    session_state: dict | None
    started_at: datetime
    ended_at: datetime | None

    model_config = {"from_attributes": True}


# ── Helpers ──────────────────────────────────────────────────────────────

async def _get_own_session_or_404(
    session_id: int, user: User, db: AsyncSession
) -> Session:
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your session")
    return session


# ── Background helpers ───────────────────────────────────────────────────


async def _ensure_concept_graph(topic_id: int, topic_title: str, topic_description: str | None) -> None:
    """Generate a concept graph for a topic if one doesn't exist yet.

    Runs as a background task so session creation isn't blocked.
    Uses its own DB session to avoid conflicts with the request session.
    """
    async with async_session_maker() as db:
        try:
            existing = await db.execute(
                select(ConceptGraph).where(ConceptGraph.topic_id == topic_id)
            )
            if existing.scalar_one_or_none() is not None:
                return  # Already exists

            logger.info("Auto-generating concept graph for topic %d (%s)", topic_id, topic_title)
            graph_data = await extract_concept_graph(topic_title, topic_description)

            cg = ConceptGraph(topic_id=topic_id, graph_data=graph_data.model_dump())
            db.add(cg)
            await db.flush()
            await db.refresh(cg)

            for node_data in graph_data.nodes:
                cn = ConceptNode(
                    graph_id=cg.id,
                    key=node_data.key,
                    name=node_data.name,
                    description=node_data.description,
                    difficulty=node_data.difficulty,
                    prerequisites=node_data.prerequisites,
                    sort_order=node_data.sort_order,
                )
                db.add(cn)

            await db.commit()
            logger.info("Concept graph created for topic %d with %d nodes", topic_id, len(graph_data.nodes))
        except Exception:
            logger.exception("Failed to auto-generate concept graph for topic %d", topic_id)


# ── Routes ───────────────────────────────────────────────────────────────

@router.post("", response_model=SessionResponse, status_code=201)
async def start_session(
    body: SessionCreate,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start a new learning session for a topic.

    Also triggers concept graph generation in the background if one
    doesn't already exist for the topic. The concept graph is needed by
    the test generator, study plan, and dashboard mastery features.
    """
    # Verify topic exists
    topic_result = await db.execute(
        select(LearningTopic).where(LearningTopic.id == body.topic_id)
    )
    topic = topic_result.scalar_one_or_none()
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")

    session = Session(user_id=user.id, topic_id=body.topic_id, status="active")
    db.add(session)
    await db.commit()
    await db.refresh(session)

    # Kick off concept graph generation in the background
    background_tasks.add_task(
        _ensure_concept_graph,
        topic_id=body.topic_id,
        topic_title=topic.title,
        topic_description=topic.description,
    )

    return session


@router.put("/{session_id}/end", response_model=SessionResponse)
async def end_session(
    session_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await _get_own_session_or_404(session_id, user, db)
    if session.status == "completed":
        raise HTTPException(status_code=400, detail="Session already ended")
    session.status = "completed"
    session.ended_at = datetime.utcnow()
    await db.commit()
    await db.refresh(session)
    return session


@router.put("/{session_id}/pause", response_model=SessionResponse)
async def pause_session(
    session_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await _get_own_session_or_404(session_id, user, db)
    if session.status != "active":
        raise HTTPException(
            status_code=400, detail=f"Cannot pause session with status '{session.status}'"
        )
    session.status = "paused"
    await db.commit()
    await db.refresh(session)
    return session


@router.put("/{session_id}/resume", response_model=SessionResponse)
async def resume_session(
    session_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await _get_own_session_or_404(session_id, user, db)
    if session.status != "paused":
        raise HTTPException(
            status_code=400, detail=f"Cannot resume session with status '{session.status}'"
        )
    session.status = "active"
    await db.commit()
    await db.refresh(session)
    return session


@router.get("/active", response_model=SessionResponse | None)
async def get_active_session(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the user's currently active or paused session, if any."""
    result = await db.execute(
        select(Session)
        .where(Session.user_id == user.id)
        .where(Session.status.in_(["active", "paused"]))
        .order_by(Session.started_at.desc())
        .limit(1)
    )
    session = result.scalar_one_or_none()
    return session


@router.get("", response_model=list[SessionResponse])
async def list_sessions(
    user: User = Depends(get_current_user),
    topic_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Session)
        .where(Session.user_id == user.id)
        .order_by(Session.started_at.desc())
    )
    if topic_id is not None:
        stmt = stmt.where(Session.topic_id == topic_id)
    rows = await db.execute(stmt)
    return rows.scalars().all()


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _get_own_session_or_404(session_id, user, db)


@router.put("/{session_id}/state", response_model=SessionResponse)
async def save_session_state(
    session_id: int,
    body: SessionStateUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Auto-save UI state (called every ~60s from the frontend)."""
    session = await _get_own_session_or_404(session_id, user, db)
    session.session_state = body.session_state
    await db.commit()
    await db.refresh(session)
    return session


@router.get("/{session_id}/export", response_class=PlainTextResponse)
async def export_session(
    session_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export session details as markdown."""
    session = await _get_own_session_or_404(session_id, user, db)

    # Get topic title
    topic_title = "Unknown"
    if session.topic_id:
        topic_result = await db.execute(
            select(LearningTopic).where(LearningTopic.id == session.topic_id)
        )
        topic = topic_result.scalar_one_or_none()
        if topic:
            topic_title = topic.title

    lines = [
        f"# Session {session.id} — {topic_title}",
        "",
        f"- **Status:** {session.status}",
        f"- **Started:** {session.started_at.isoformat()}",
        f"- **Ended:** {session.ended_at.isoformat() if session.ended_at else 'In progress'}",
        "",
        "## Session State",
        "",
        f"```json\n{session.session_state}\n```",
    ]
    return "\n".join(lines)
