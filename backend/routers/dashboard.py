"""Dashboard router — mastery snapshot, learner goals, study plan."""

from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.concept import ConceptGraph, ConceptNode
from models.dashboard_state import DashboardState, LearnerGoal
from models.database import get_db
from models.mastery import MasteryState
from models.topic import LearningTopic
from models.user import User
from utils.dependencies import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


# ── Schemas ───────────────────────────────────────────────────────────────


class ConceptMasteryItem(BaseModel):
    concept_node_id: int
    concept_key: str
    concept_name: str
    difficulty: str
    mastery_score: float
    attempts_count: int


class MasterySnapshot(BaseModel):
    total_concepts: int
    mastered_count: int
    in_progress_count: int
    not_started_count: int
    overall_pct: float
    concepts: list[ConceptMasteryItem]


class LearnerGoalResponse(BaseModel):
    id: int
    topic_id: int
    concept_node_id: int | None
    concept_name: str | None
    target_mastery: float
    deadline: date | None
    priority: int
    is_completed: bool
    is_ai_suggested: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DashboardResponse(BaseModel):
    topic_id: int
    topic_title: str
    mastery_snapshot: MasterySnapshot
    goals: list[LearnerGoalResponse]
    study_plan: dict | None


class SaveDashboardRequest(BaseModel):
    study_plan: dict | None = None


class CreateGoalRequest(BaseModel):
    concept_node_id: int | None = None
    target_mastery: float = Field(default=0.8, ge=0.0, le=1.0)
    deadline: date | None = None
    priority: int = Field(default=1, ge=1, le=5)


class UpdateGoalRequest(BaseModel):
    concept_node_id: int | None = None
    target_mastery: float | None = Field(default=None, ge=0.0, le=1.0)
    deadline: date | None = None
    priority: int | None = Field(default=None, ge=1, le=5)
    is_completed: bool | None = None


# ── Helpers ───────────────────────────────────────────────────────────────


async def _build_mastery_snapshot(
    topic_id: int,
    user_id: int,
    db: AsyncSession,
) -> tuple[MasterySnapshot, list[ConceptNode]]:
    """Build mastery snapshot from concept nodes + mastery states."""
    graph_result = await db.execute(
        select(ConceptGraph).where(ConceptGraph.topic_id == topic_id)
    )
    graph = graph_result.scalar_one_or_none()
    nodes: list[ConceptNode] = []
    if graph:
        nodes_result = await db.execute(
            select(ConceptNode)
            .where(ConceptNode.graph_id == graph.id)
            .order_by(ConceptNode.sort_order)
        )
        nodes = list(nodes_result.scalars().all())

    node_ids = [n.id for n in nodes]
    mastery_map: dict[int, MasteryState] = {}
    if node_ids:
        mastery_result = await db.execute(
            select(MasteryState).where(
                MasteryState.user_id == user_id,
                MasteryState.concept_node_id.in_(node_ids),
            )
        )
        for ms in mastery_result.scalars().all():
            mastery_map[ms.concept_node_id] = ms

    items: list[ConceptMasteryItem] = []
    mastered = 0
    in_progress = 0
    not_started = 0
    total_score = 0.0

    for node in nodes:
        ms = mastery_map.get(node.id)
        score = ms.mastery_score if ms else 0.0
        attempts = ms.attempts_count if ms else 0
        total_score += score

        if score >= 0.7:
            mastered += 1
        elif score >= 0.3:
            in_progress += 1
        else:
            not_started += 1

        items.append(
            ConceptMasteryItem(
                concept_node_id=node.id,
                concept_key=node.key,
                concept_name=node.name,
                difficulty=node.difficulty,
                mastery_score=round(score, 4),
                attempts_count=attempts,
            )
        )

    total = len(nodes)
    overall_pct = round((total_score / total) * 100, 1) if total > 0 else 0.0

    return (
        MasterySnapshot(
            total_concepts=total,
            mastered_count=mastered,
            in_progress_count=in_progress,
            not_started_count=not_started,
            overall_pct=overall_pct,
            concepts=items,
        ),
        nodes,
    )


async def _build_goal_response(
    goal: LearnerGoal,
    node_map: dict[int, ConceptNode],
) -> LearnerGoalResponse:
    node = node_map.get(goal.concept_node_id) if goal.concept_node_id else None
    return LearnerGoalResponse(
        id=goal.id,
        topic_id=goal.topic_id,
        concept_node_id=goal.concept_node_id,
        concept_name=node.name if node else None,
        target_mastery=goal.target_mastery,
        deadline=goal.deadline,
        priority=goal.priority,
        is_completed=goal.is_completed,
        is_ai_suggested=goal.is_ai_suggested,
        created_at=goal.created_at,
        updated_at=goal.updated_at,
    )


async def _get_node_map(topic_id: int, db: AsyncSession) -> dict[int, ConceptNode]:
    graph_result = await db.execute(
        select(ConceptGraph).where(ConceptGraph.topic_id == topic_id)
    )
    graph = graph_result.scalar_one_or_none()
    node_map: dict[int, ConceptNode] = {}
    if graph:
        nodes_result = await db.execute(
            select(ConceptNode).where(ConceptNode.graph_id == graph.id)
        )
        for n in nodes_result.scalars().all():
            node_map[n.id] = n
    return node_map


# ── Routes ────────────────────────────────────────────────────────────────


@router.get("/{topic_id}", response_model=DashboardResponse)
async def get_dashboard(
    topic_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return dashboard data: mastery snapshot, learner goals, and study plan."""
    topic_result = await db.execute(
        select(LearningTopic).where(LearningTopic.id == topic_id)
    )
    topic = topic_result.scalar_one_or_none()
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")

    snapshot, nodes = await _build_mastery_snapshot(topic_id, user.id, db)
    node_map = {n.id: n for n in nodes}

    ds_result = await db.execute(
        select(DashboardState).where(
            DashboardState.user_id == user.id,
            DashboardState.topic_id == topic_id,
        )
    )
    ds = ds_result.scalar_one_or_none()
    study_plan = ds.study_plan if ds else None

    goals_result = await db.execute(
        select(LearnerGoal).where(
            LearnerGoal.user_id == user.id,
            LearnerGoal.topic_id == topic_id,
        )
    )
    goals = goals_result.scalars().all()
    goal_responses = [await _build_goal_response(g, node_map) for g in goals]

    return DashboardResponse(
        topic_id=topic_id,
        topic_title=topic.title,
        mastery_snapshot=snapshot,
        goals=goal_responses,
        study_plan=study_plan,
    )


@router.put("/{topic_id}", response_model=DashboardResponse)
async def save_dashboard(
    topic_id: int,
    body: SaveDashboardRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Persist dashboard edits (study plan) and return updated dashboard."""
    topic_result = await db.execute(
        select(LearningTopic).where(LearningTopic.id == topic_id)
    )
    topic = topic_result.scalar_one_or_none()
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")

    ds_result = await db.execute(
        select(DashboardState).where(
            DashboardState.user_id == user.id,
            DashboardState.topic_id == topic_id,
        )
    )
    ds = ds_result.scalar_one_or_none()
    if ds is None:
        ds = DashboardState(
            user_id=user.id,
            topic_id=topic_id,
            study_plan=body.study_plan,
        )
        db.add(ds)
    else:
        if body.study_plan is not None:
            ds.study_plan = body.study_plan

    await db.commit()
    return await get_dashboard(topic_id=topic_id, user=user, db=db)


@router.get("/{topic_id}/goals", response_model=list[LearnerGoalResponse])
async def list_goals(
    topic_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List learner goals for a topic."""
    node_map = await _get_node_map(topic_id, db)

    goals_result = await db.execute(
        select(LearnerGoal).where(
            LearnerGoal.user_id == user.id,
            LearnerGoal.topic_id == topic_id,
        )
    )
    goals = goals_result.scalars().all()
    return [await _build_goal_response(g, node_map) for g in goals]


@router.post("/{topic_id}/goals", response_model=LearnerGoalResponse, status_code=201)
async def create_goal(
    topic_id: int,
    body: CreateGoalRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new learner goal for a topic."""
    node_map: dict[int, ConceptNode] = {}
    if body.concept_node_id is not None:
        node_result = await db.execute(
            select(ConceptNode).where(ConceptNode.id == body.concept_node_id)
        )
        node = node_result.scalar_one_or_none()
        if node is None:
            raise HTTPException(status_code=404, detail="Concept node not found")
        node_map[node.id] = node

    goal = LearnerGoal(
        user_id=user.id,
        topic_id=topic_id,
        concept_node_id=body.concept_node_id,
        target_mastery=body.target_mastery,
        deadline=body.deadline,
        priority=body.priority,
        is_ai_suggested=False,
    )
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return await _build_goal_response(goal, node_map)


@router.put("/goals/{goal_id}", response_model=LearnerGoalResponse)
async def update_goal(
    goal_id: int,
    body: UpdateGoalRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing learner goal."""
    goal_result = await db.execute(
        select(LearnerGoal).where(
            LearnerGoal.id == goal_id,
            LearnerGoal.user_id == user.id,
        )
    )
    goal = goal_result.scalar_one_or_none()
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")

    if body.concept_node_id is not None:
        goal.concept_node_id = body.concept_node_id
    if body.target_mastery is not None:
        goal.target_mastery = body.target_mastery
    if body.deadline is not None:
        goal.deadline = body.deadline
    if body.priority is not None:
        goal.priority = body.priority
    if body.is_completed is not None:
        goal.is_completed = body.is_completed

    await db.commit()
    await db.refresh(goal)

    node_map: dict[int, ConceptNode] = {}
    if goal.concept_node_id:
        node_result = await db.execute(
            select(ConceptNode).where(ConceptNode.id == goal.concept_node_id)
        )
        node = node_result.scalar_one_or_none()
        if node:
            node_map[node.id] = node

    return await _build_goal_response(goal, node_map)


@router.delete("/goals/{goal_id}", status_code=204)
async def delete_goal(
    goal_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a learner goal."""
    goal_result = await db.execute(
        select(LearnerGoal).where(
            LearnerGoal.id == goal_id,
            LearnerGoal.user_id == user.id,
        )
    )
    goal = goal_result.scalar_one_or_none()
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")

    await db.delete(goal)
    await db.commit()
