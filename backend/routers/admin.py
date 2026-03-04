"""Admin / researcher dashboard routes — participants, sessions, events, export, metrics."""

import csv
import io
import zipfile
from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import case, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.assessment import Assessment
from models.database import get_db
from models.event import BehavioralEvent, ChatEvent, SearchEvent
from models.reflection import Reflection
from models.session import Session
from models.subgoal import Subgoal
from models.topic import LearningTopic
from models.user import User
from utils.dependencies import require_researcher

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ── Schemas ──────────────────────────────────────────────────────────────


class ParticipantResponse(BaseModel):
    id: int
    email: str
    display_name: str | None
    role: str
    created_at: datetime
    session_count: int
    last_active: datetime | None

    model_config = {"from_attributes": True}


class AdminSessionResponse(BaseModel):
    id: int
    user_id: int | None
    user_email: str | None
    topic_id: int | None
    topic_title: str | None
    status: str
    started_at: datetime
    ended_at: datetime | None

    model_config = {"from_attributes": True}


class AdminEventResponse(BaseModel):
    id: int
    session_id: int
    user_id: int | None
    event_type: str
    event_data: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class MetricsResponse(BaseModel):
    total_participants: int
    total_sessions: int
    total_completed_sessions: int
    avg_session_duration_ms: float | None
    total_search_events: int
    total_chat_events: int
    search_to_chat_ratio: float | None
    subgoal_completion_rate: float | None


# ── Routes ───────────────────────────────────────────────────────────────


@router.get("/participants", response_model=list[ParticipantResponse])
async def list_participants(
    _user: User = Depends(require_researcher),
    db: AsyncSession = Depends(get_db),
):
    """List all participants with session counts and last-active timestamps."""
    session_stats = (
        select(
            Session.user_id,
            func.count(Session.id).label("session_count"),
            func.max(Session.started_at).label("last_active"),
        )
        .group_by(Session.user_id)
        .subquery()
    )

    stmt = (
        select(
            User.id,
            User.email,
            User.display_name,
            User.role,
            User.created_at,
            func.coalesce(session_stats.c.session_count, 0).label("session_count"),
            session_stats.c.last_active,
        )
        .outerjoin(session_stats, User.id == session_stats.c.user_id)
        .order_by(User.created_at.desc())
    )

    rows = await db.execute(stmt)
    return [
        ParticipantResponse(
            id=r.id,
            email=r.email,
            display_name=r.display_name,
            role=r.role,
            created_at=r.created_at,
            session_count=r.session_count,
            last_active=r.last_active,
        )
        for r in rows.all()
    ]


@router.get("/sessions", response_model=list[AdminSessionResponse])
async def list_sessions(
    user_id: int | None = Query(None),
    topic_id: int | None = Query(None),
    status: str | None = Query(None),
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    _user: User = Depends(require_researcher),
    db: AsyncSession = Depends(get_db),
):
    """List sessions with optional filters."""
    stmt = (
        select(
            Session.id,
            Session.user_id,
            User.email.label("user_email"),
            Session.topic_id,
            LearningTopic.title.label("topic_title"),
            Session.status,
            Session.started_at,
            Session.ended_at,
        )
        .outerjoin(User, Session.user_id == User.id)
        .outerjoin(LearningTopic, Session.topic_id == LearningTopic.id)
        .order_by(Session.started_at.desc())
    )

    if user_id is not None:
        stmt = stmt.where(Session.user_id == user_id)
    if topic_id is not None:
        stmt = stmt.where(Session.topic_id == topic_id)
    if status is not None:
        stmt = stmt.where(Session.status == status)
    if from_date is not None:
        stmt = stmt.where(Session.started_at >= datetime.combine(from_date, datetime.min.time()))
    if to_date is not None:
        stmt = stmt.where(Session.started_at <= datetime.combine(to_date, datetime.max.time()))

    stmt = stmt.limit(limit).offset(offset)
    rows = await db.execute(stmt)
    return [
        AdminSessionResponse(
            id=r.id,
            user_id=r.user_id,
            user_email=r.user_email,
            topic_id=r.topic_id,
            topic_title=r.topic_title,
            status=r.status,
            started_at=r.started_at,
            ended_at=r.ended_at,
        )
        for r in rows.all()
    ]


@router.get("/events", response_model=list[AdminEventResponse])
async def list_events(
    event_type: str | None = Query(None),
    user_id: int | None = Query(None),
    session_id: int | None = Query(None),
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    _user: User = Depends(require_researcher),
    db: AsyncSession = Depends(get_db),
):
    """Query behavioral events with filters."""
    stmt = (
        select(BehavioralEvent)
        .order_by(BehavioralEvent.created_at.desc())
    )

    if event_type is not None:
        stmt = stmt.where(BehavioralEvent.event_type == event_type)
    if user_id is not None:
        stmt = stmt.where(BehavioralEvent.user_id == user_id)
    if session_id is not None:
        stmt = stmt.where(BehavioralEvent.session_id == session_id)
    if from_date is not None:
        stmt = stmt.where(BehavioralEvent.created_at >= datetime.combine(from_date, datetime.min.time()))
    if to_date is not None:
        stmt = stmt.where(BehavioralEvent.created_at <= datetime.combine(to_date, datetime.max.time()))

    stmt = stmt.limit(limit).offset(offset)
    rows = await db.execute(stmt)
    return rows.scalars().all()


@router.get("/export/csv")
async def export_csv(
    user_id: int | None = Query(None),
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    _user: User = Depends(require_researcher),
    db: AsyncSession = Depends(get_db),
):
    """Export all data as a ZIP of CSVs (sessions, events, assessments, reflections)."""

    def _date_filters(stmt, date_col):
        if from_date is not None:
            stmt = stmt.where(date_col >= datetime.combine(from_date, datetime.min.time()))
        if to_date is not None:
            stmt = stmt.where(date_col <= datetime.combine(to_date, datetime.max.time()))
        return stmt

    def _user_filter(stmt, user_col):
        if user_id is not None:
            stmt = stmt.where(user_col == user_id)
        return stmt

    # Sessions
    sessions_stmt = select(
        Session.id, Session.user_id, Session.topic_id,
        Session.status, Session.started_at, Session.ended_at,
    )
    sessions_stmt = _user_filter(sessions_stmt, Session.user_id)
    sessions_stmt = _date_filters(sessions_stmt, Session.started_at)
    sessions_rows = (await db.execute(sessions_stmt)).all()

    # Behavioral events
    events_stmt = select(
        BehavioralEvent.id, BehavioralEvent.session_id,
        BehavioralEvent.user_id, BehavioralEvent.event_type,
        BehavioralEvent.event_data, BehavioralEvent.created_at,
    )
    events_stmt = _user_filter(events_stmt, BehavioralEvent.user_id)
    events_stmt = _date_filters(events_stmt, BehavioralEvent.created_at)
    events_rows = (await db.execute(events_stmt)).all()

    # Assessments
    assessments_stmt = select(
        Assessment.id, Assessment.session_id, Assessment.user_id,
        Assessment.assessment_type, Assessment.score,
        Assessment.max_score, Assessment.created_at, Assessment.completed_at,
    )
    assessments_stmt = _user_filter(assessments_stmt, Assessment.user_id)
    assessments_stmt = _date_filters(assessments_stmt, Assessment.created_at)
    assessments_rows = (await db.execute(assessments_stmt)).all()

    # Reflections
    reflections_stmt = select(
        Reflection.id, Reflection.session_id, Reflection.user_id,
        Reflection.reflection_text, Reflection.confidence_rating,
        Reflection.difficulty_rating, Reflection.created_at,
    )
    reflections_stmt = _user_filter(reflections_stmt, Reflection.user_id)
    reflections_stmt = _date_filters(reflections_stmt, Reflection.created_at)
    reflections_rows = (await db.execute(reflections_stmt)).all()

    # Build ZIP in memory
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for filename, headers, rows in [
            (
                "sessions.csv",
                ["id", "user_id", "topic_id", "status", "started_at", "ended_at"],
                sessions_rows,
            ),
            (
                "behavioral_events.csv",
                ["id", "session_id", "user_id", "event_type", "event_data", "created_at"],
                events_rows,
            ),
            (
                "assessments.csv",
                ["id", "session_id", "user_id", "assessment_type", "score", "max_score", "created_at", "completed_at"],
                assessments_rows,
            ),
            (
                "reflections.csv",
                ["id", "session_id", "user_id", "reflection_text", "confidence_rating", "difficulty_rating", "created_at"],
                reflections_rows,
            ),
        ]:
            csv_buf = io.StringIO()
            writer = csv.writer(csv_buf)
            writer.writerow(headers)
            for row in rows:
                writer.writerow([str(v) if v is not None else "" for v in row])
            zf.writestr(filename, csv_buf.getvalue())

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=learnflow_export.zip"},
    )


@router.get("/metrics", response_model=MetricsResponse)
async def get_metrics(
    _user: User = Depends(require_researcher),
    db: AsyncSession = Depends(get_db),
):
    """Aggregate metrics for the research dashboard."""
    total_participants = (await db.execute(
        select(func.count(User.id))
    )).scalar_one()

    total_sessions = (await db.execute(
        select(func.count(Session.id))
    )).scalar_one()

    total_completed = (await db.execute(
        select(func.count(Session.id)).where(Session.status == "completed")
    )).scalar_one()

    # Avg session duration for completed sessions (in milliseconds)
    avg_dur_result = await db.execute(
        select(
            func.avg(
                extract("epoch", Session.ended_at) - extract("epoch", Session.started_at)
            ) * 1000
        ).where(Session.status == "completed", Session.ended_at.isnot(None))
    )
    avg_duration_ms = avg_dur_result.scalar_one()

    total_search = (await db.execute(
        select(func.count(SearchEvent.id))
    )).scalar_one()

    total_chat = (await db.execute(
        select(func.count(ChatEvent.id))
    )).scalar_one()

    ratio = round(total_search / total_chat, 2) if total_chat > 0 else None

    # Subgoal completion rate
    total_subgoals = (await db.execute(
        select(func.count(Subgoal.id))
    )).scalar_one()
    completed_subgoals = (await db.execute(
        select(func.count(Subgoal.id)).where(Subgoal.is_completed == True)  # noqa: E712
    )).scalar_one()
    subgoal_rate = (
        round(completed_subgoals / total_subgoals, 2)
        if total_subgoals > 0
        else None
    )

    return MetricsResponse(
        total_participants=total_participants,
        total_sessions=total_sessions,
        total_completed_sessions=total_completed,
        avg_session_duration_ms=avg_duration_ms,
        total_search_events=total_search,
        total_chat_events=total_chat,
        search_to_chat_ratio=ratio,
        subgoal_completion_rate=subgoal_rate,
    )
