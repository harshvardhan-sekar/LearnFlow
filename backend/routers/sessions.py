"""Sessions router — start, end, pause, resume, list, state, export."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from models.session import Session
from models.topic import LearningTopic
from models.user import User
from utils.dependencies import get_current_user

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

async def _get_session_or_404(
    session_id: int, db: AsyncSession
) -> Session:
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


# ── Routes ───────────────────────────────────────────────────────────────

@router.post("/", response_model=SessionResponse, status_code=201)
async def start_session(
    body: SessionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start a new learning session for a topic."""
    # Verify topic exists
    topic_result = await db.execute(
        select(LearningTopic).where(LearningTopic.id == body.topic_id)
    )
    if topic_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Topic not found")

    session = Session(user_id=user.id, topic_id=body.topic_id, status="active")
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.put("/{session_id}/end", response_model=SessionResponse)
async def end_session(
    session_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await _get_session_or_404(session_id, db)
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
    session = await _get_session_or_404(session_id, db)
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
    session = await _get_session_or_404(session_id, db)
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


@router.get("/", response_model=list[SessionResponse])
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
    return await _get_session_or_404(session_id, db)


@router.put("/{session_id}/state", response_model=SessionResponse)
async def save_session_state(
    session_id: int,
    body: SessionStateUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Auto-save UI state (called every ~60s from the frontend)."""
    session = await _get_session_or_404(session_id, db)
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
    session = await _get_session_or_404(session_id, db)

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
