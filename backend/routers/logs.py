"""Behavioral event logging router — batch insert and panel-focus shorthand."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from models.event import BehavioralEvent
from models.user import User
from utils.dependencies import get_current_user

router = APIRouter(prefix="/api/logs", tags=["logs"])

ALLOWED_EVENT_TYPES = {
    "search_query",
    "search_click",
    "chat_message",
    "subgoal_create",
    "subgoal_edit",
    "subgoal_reorder",
    "subgoal_check",
    "subgoal_uncheck",
    "panel_focus",
    "template_view",
    "test_start",
    "test_submit",
    "hint_request",
    "mastery_override",
    "goal_create",
    "goal_edit",
    "dashboard_view",
    "interface_switch",
    "session_started",
    "session_ended",
    "reflection_submitted",
    "assessment_submitted",
    "page_navigation",
}


# ── Schemas ──────────────────────────────────────────────────────────────


class EventItem(BaseModel):
    event_type: str
    event_data: dict | None = None
    session_id: int
    created_at: datetime | None = None


class BatchEventsRequest(BaseModel):
    events: list[EventItem]


class EventResponse(BaseModel):
    id: int
    session_id: int
    user_id: int | None
    event_type: str
    event_data: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PanelFocusRequest(BaseModel):
    panel: str
    duration_ms: int
    session_id: int


# ── Routes ───────────────────────────────────────────────────────────────


@router.post("/events", response_model=list[EventResponse], status_code=201)
async def batch_log_events(
    body: BatchEventsRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Batch insert behavioral events."""
    if not body.events:
        raise HTTPException(status_code=400, detail="events list must not be empty")

    # Validate event types
    invalid = [e.event_type for e in body.events if e.event_type not in ALLOWED_EVENT_TYPES]
    if invalid:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid event types: {', '.join(set(invalid))}",
        )

    rows: list[BehavioralEvent] = []
    for item in body.events:
        row = BehavioralEvent(
            session_id=item.session_id,
            user_id=user.id,
            event_type=item.event_type,
            event_data=item.event_data,
        )
        if item.created_at is not None:
            row.created_at = item.created_at
        db.add(row)
        rows.append(row)

    await db.commit()
    for row in rows:
        await db.refresh(row)
    return rows


@router.post("/panel-focus", response_model=EventResponse, status_code=201)
async def log_panel_focus(
    body: PanelFocusRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Shorthand for logging a panel_focus behavioral event."""
    row = BehavioralEvent(
        session_id=body.session_id,
        user_id=user.id,
        event_type="panel_focus",
        event_data={"panel": body.panel, "duration_ms": body.duration_ms},
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row
