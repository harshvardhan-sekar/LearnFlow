"""Subgoals CRUD router with AI generation and event logging."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.concept import ConceptGraph, ConceptNode
from models.database import get_db
from models.event import SubgoalEvent
from models.subgoal import Subgoal
from models.topic import LearningTopic
from models.user import User
from services.subgoal_generator import generate_subgoals
from utils.dependencies import get_current_user

router = APIRouter(prefix="/api/subgoals", tags=["subgoals"])


# ── Schemas ──────────────────────────────────────────────────────────────


class SubgoalCreate(BaseModel):
    topic_id: int
    title: str
    description: str | None = None


class SubgoalUpdate(BaseModel):
    title: str | None = None
    description: str | None = None


class SubgoalResponse(BaseModel):
    id: int
    topic_id: int
    user_id: int | None
    title: str
    description: str | None
    sort_order: int
    is_completed: bool
    is_ai_generated: bool
    concept_node_key: str | None = None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReorderRequest(BaseModel):
    subgoal_ids: list[int]


class GenerateRequest(BaseModel):
    topic_id: int
    session_id: int | None = None


# ── Helpers ──────────────────────────────────────────────────────────────


async def _log_subgoal_event(
    db: AsyncSession,
    *,
    session_id: int | None,
    user_id: int | None,
    subgoal_id: int | None,
    event_type: str,
    old_value: str | None = None,
    new_value: str | None = None,
) -> None:
    """Write a row to subgoal_events."""
    # session_id is required by the FK — skip logging when no session context
    if session_id is None:
        return
    db.add(
        SubgoalEvent(
            session_id=session_id,
            user_id=user_id,
            subgoal_id=subgoal_id,
            event_type=event_type,
            old_value=old_value,
            new_value=new_value,
        )
    )


async def _get_topic_or_404(
    topic_id: int, db: AsyncSession
) -> LearningTopic:
    result = await db.execute(
        select(LearningTopic).where(LearningTopic.id == topic_id)
    )
    topic = result.scalar_one_or_none()
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic


async def _get_subgoal_or_404(
    subgoal_id: int, user: User, db: AsyncSession
) -> Subgoal:
    result = await db.execute(
        select(Subgoal).where(Subgoal.id == subgoal_id)
    )
    sg = result.scalar_one_or_none()
    if sg is None:
        raise HTTPException(status_code=404, detail="Subgoal not found")
    if sg.user_id is not None and sg.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your subgoal")
    return sg


# ── Routes ───────────────────────────────────────────────────────────────
# NOTE: Static paths (/reorder, /generate) MUST be defined before
# parameterised paths (/{subgoal_id}) so FastAPI matches them first.


@router.get("/{topic_id}", response_model=list[SubgoalResponse])
async def list_subgoals(
    topic_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List subgoals for a topic ordered by sort_order."""
    await _get_topic_or_404(topic_id, db)
    result = await db.execute(
        select(Subgoal)
        .where(Subgoal.topic_id == topic_id, Subgoal.user_id == user.id)
        .order_by(Subgoal.sort_order)
    )
    return result.scalars().all()


@router.post("", response_model=SubgoalResponse, status_code=201)
async def create_subgoal(
    body: SubgoalCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    session_id: int | None = None,
):
    """Create a user-authored subgoal."""
    await _get_topic_or_404(body.topic_id, db)

    # Determine next sort_order
    max_order_result = await db.execute(
        select(Subgoal.sort_order)
        .where(Subgoal.topic_id == body.topic_id, Subgoal.user_id == user.id)
        .order_by(Subgoal.sort_order.desc())
        .limit(1)
    )
    max_order = max_order_result.scalar_one_or_none()
    next_order = (max_order or 0) + 1

    sg = Subgoal(
        topic_id=body.topic_id,
        user_id=user.id,
        title=body.title,
        description=body.description,
        sort_order=next_order,
        is_ai_generated=False,
    )
    db.add(sg)
    await db.commit()
    await db.refresh(sg)

    await _log_subgoal_event(
        db,
        session_id=session_id,
        user_id=user.id,
        subgoal_id=sg.id,
        event_type="subgoal_created",
        new_value=sg.title,
    )
    await db.commit()
    return sg


@router.post("/generate", response_model=list[SubgoalResponse], status_code=201)
async def generate_subgoals_endpoint(
    body: GenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Use GPT to generate 6-8 scaffolded subgoals for a topic.

    Saves them to DB with is_ai_generated=true and returns them.
    """
    topic = await _get_topic_or_404(body.topic_id, db)

    # Check for an existing concept graph to align subgoals with
    concept_nodes_data: list[dict] | None = None
    cg_result = await db.execute(
        select(ConceptGraph).where(ConceptGraph.topic_id == body.topic_id)
    )
    cg = cg_result.scalar_one_or_none()
    if cg is not None:
        cn_result = await db.execute(
            select(ConceptNode)
            .where(ConceptNode.graph_id == cg.id)
            .order_by(ConceptNode.sort_order)
        )
        concept_nodes_data = [
            {
                "key": cn.key,
                "name": cn.name,
                "description": cn.description or "",
                "difficulty": cn.difficulty,
            }
            for cn in cn_result.scalars().all()
        ]

    generated = await generate_subgoals(
        topic.title, topic.description, concept_nodes=concept_nodes_data
    )
    if not generated:
        raise HTTPException(status_code=500, detail="Failed to generate subgoals")

    # Determine starting sort_order
    max_order_result = await db.execute(
        select(Subgoal.sort_order)
        .where(Subgoal.topic_id == body.topic_id, Subgoal.user_id == user.id)
        .order_by(Subgoal.sort_order.desc())
        .limit(1)
    )
    max_order = max_order_result.scalar_one_or_none() or 0

    created: list[Subgoal] = []
    for idx, sg_data in enumerate(generated):
        sg = Subgoal(
            topic_id=body.topic_id,
            user_id=user.id,
            title=sg_data["title"],
            description=sg_data["description"],
            sort_order=max_order + idx + 1,
            is_ai_generated=True,
            concept_node_key=sg_data.get("concept_node_key"),
        )
        db.add(sg)
        created.append(sg)

    await db.commit()

    for sg in created:
        await db.refresh(sg)

    # Log generation event for each subgoal
    for sg in created:
        await _log_subgoal_event(
            db,
            session_id=body.session_id,
            user_id=user.id,
            subgoal_id=sg.id,
            event_type="subgoal_ai_generated",
            new_value=sg.title,
        )
    await db.commit()

    return created


@router.put("/reorder", response_model=list[SubgoalResponse])
async def reorder_subgoals(
    body: ReorderRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    session_id: int | None = None,
):
    """Bulk-update sort_order based on the ordered list of IDs."""
    if not body.subgoal_ids:
        raise HTTPException(status_code=400, detail="subgoal_ids must not be empty")

    result = await db.execute(
        select(Subgoal).where(
            Subgoal.id.in_(body.subgoal_ids), Subgoal.user_id == user.id
        )
    )
    subgoals_by_id = {sg.id: sg for sg in result.scalars().all()}

    if len(subgoals_by_id) != len(body.subgoal_ids):
        raise HTTPException(status_code=400, detail="Some subgoal IDs not found")

    old_order = sorted(subgoals_by_id.values(), key=lambda s: s.sort_order)
    old_id_order = [s.id for s in old_order]

    for idx, sg_id in enumerate(body.subgoal_ids):
        subgoals_by_id[sg_id].sort_order = idx

    await db.commit()

    await _log_subgoal_event(
        db,
        session_id=session_id,
        user_id=user.id,
        subgoal_id=None,
        event_type="subgoal_reordered",
        old_value=str(old_id_order),
        new_value=str(body.subgoal_ids),
    )
    await db.commit()

    # Return in new order — refresh to pick up server-side updated_at
    ordered = [subgoals_by_id[sid] for sid in body.subgoal_ids]
    for sg in ordered:
        await db.refresh(sg)
    return ordered


@router.put("/{subgoal_id}", response_model=SubgoalResponse)
async def update_subgoal(
    subgoal_id: int,
    body: SubgoalUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    session_id: int | None = None,
):
    """Update title and/or description."""
    sg = await _get_subgoal_or_404(subgoal_id, user, db)
    old_title = sg.title

    if body.title is not None:
        sg.title = body.title
    if body.description is not None:
        sg.description = body.description

    await db.commit()
    await db.refresh(sg)

    await _log_subgoal_event(
        db,
        session_id=session_id,
        user_id=user.id,
        subgoal_id=sg.id,
        event_type="subgoal_edited",
        old_value=old_title,
        new_value=sg.title,
    )
    await db.commit()
    return sg


@router.put("/{subgoal_id}/toggle", response_model=SubgoalResponse)
async def toggle_subgoal(
    subgoal_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    session_id: int | None = None,
):
    """Toggle is_completed and set/clear completed_at."""
    sg = await _get_subgoal_or_404(subgoal_id, user, db)

    sg.is_completed = not sg.is_completed
    sg.completed_at = datetime.now(UTC) if sg.is_completed else None

    await db.commit()
    await db.refresh(sg)

    event_type = "subgoal_checked" if sg.is_completed else "subgoal_unchecked"
    await _log_subgoal_event(
        db,
        session_id=session_id,
        user_id=user.id,
        subgoal_id=sg.id,
        event_type=event_type,
    )
    await db.commit()
    return sg


@router.delete("/{subgoal_id}", status_code=204)
async def delete_subgoal(
    subgoal_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    session_id: int | None = None,
):
    """Delete a subgoal."""
    sg = await _get_subgoal_or_404(subgoal_id, user, db)
    deleted_title = sg.title

    await _log_subgoal_event(
        db,
        session_id=session_id,
        user_id=user.id,
        subgoal_id=sg.id,
        event_type="subgoal_deleted",
        old_value=deleted_title,
    )
    await db.commit()

    await db.delete(sg)
    await db.commit()
