"""Mastery router — retrieve, update, and override per-concept mastery states."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from engines.mastery_engine import process_question_result
from engines.recommendation_engine import get_recommendations
from models.concept import ConceptGraph, ConceptNode
from models.database import get_db
from models.mastery import MasteryState
from models.user import User
from utils.dependencies import get_current_user

router = APIRouter(prefix="/api/mastery", tags=["mastery"])


# ── Schemas ───────────────────────────────────────────────────────────────


class MasteryStateResponse(BaseModel):
    id: int
    concept_node_id: int
    concept_key: str
    concept_name: str
    mastery_score: float
    attempts_count: int
    correct_count: int
    last_tested_at: datetime | None
    updated_at: datetime

    model_config = {"from_attributes": True}


class UpdateMasteryRequest(BaseModel):
    concept_node_id: int
    is_correct: bool
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard)$")


class OverrideMasteryRequest(BaseModel):
    concept_node_id: int
    new_mastery: float = Field(ge=0.0, le=1.0)


class RecommendationResponse(BaseModel):
    concept_key: str
    concept_name: str
    mastery: float
    focus_weight: float


# ── Routes ────────────────────────────────────────────────────────────────


@router.get("/{topic_id}", response_model=list[MasteryStateResponse])
async def get_topic_mastery(
    topic_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all mastery states for the current user's concepts in a topic.

    Concepts with no prior attempts are not included — only concepts the user
    has been tested on will appear. Use GET /api/concepts/{topic_id} for the
    full list of concept nodes.
    """
    # Verify topic has a concept graph
    graph_result = await db.execute(
        select(ConceptGraph).where(ConceptGraph.topic_id == topic_id)
    )
    graph = graph_result.scalar_one_or_none()
    if graph is None:
        raise HTTPException(
            status_code=404, detail="No concept graph for this topic"
        )

    # Get all node IDs for this graph
    nodes_result = await db.execute(
        select(ConceptNode).where(ConceptNode.graph_id == graph.id)
    )
    nodes = nodes_result.scalars().all()
    node_id_to_node = {n.id: n for n in nodes}

    # Fetch mastery states for this user + these nodes
    mastery_result = await db.execute(
        select(MasteryState).where(
            MasteryState.user_id == user.id,
            MasteryState.concept_node_id.in_(list(node_id_to_node.keys())),
        )
    )
    states = mastery_result.scalars().all()

    # Build response with concept metadata joined in
    response = []
    for state in states:
        node = node_id_to_node[state.concept_node_id]
        response.append(
            MasteryStateResponse(
                id=state.id,
                concept_node_id=state.concept_node_id,
                concept_key=node.key,
                concept_name=node.name,
                mastery_score=state.mastery_score,
                attempts_count=state.attempts_count,
                correct_count=state.correct_count,
                last_tested_at=state.last_tested_at,
                updated_at=state.updated_at,
            )
        )

    return response


@router.post("/update", response_model=MasteryStateResponse)
async def update_mastery(
    body: UpdateMasteryRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update mastery after answering a test question.

    Applies the EWA algorithm with time decay. Creates the mastery state row
    if it doesn't exist (first attempt), otherwise updates it.
    """
    try:
        state = await process_question_result(
            user_id=user.id,
            concept_node_id=body.concept_node_id,
            is_correct=body.is_correct,
            difficulty=body.difficulty,
            db=db,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    # Fetch node for response metadata
    node_result = await db.execute(
        select(ConceptNode).where(ConceptNode.id == body.concept_node_id)
    )
    node = node_result.scalar_one()

    return MasteryStateResponse(
        id=state.id,
        concept_node_id=state.concept_node_id,
        concept_key=node.key,
        concept_name=node.name,
        mastery_score=state.mastery_score,
        attempts_count=state.attempts_count,
        correct_count=state.correct_count,
        last_tested_at=state.last_tested_at,
        updated_at=state.updated_at,
    )


@router.put("/override", response_model=MasteryStateResponse)
async def override_mastery(
    body: OverrideMasteryRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually override a mastery score (researcher/admin use).

    Sets the mastery_score directly without touching attempts_count or
    correct_count. Intended for researcher corrections and seeding test data.
    """
    # Verify concept node exists
    node_result = await db.execute(
        select(ConceptNode).where(ConceptNode.id == body.concept_node_id)
    )
    node = node_result.scalar_one_or_none()
    if node is None:
        raise HTTPException(
            status_code=404,
            detail=f"ConceptNode {body.concept_node_id} not found",
        )

    # Fetch or create mastery state
    state_result = await db.execute(
        select(MasteryState).where(
            MasteryState.user_id == user.id,
            MasteryState.concept_node_id == body.concept_node_id,
        )
    )
    state = state_result.scalar_one_or_none()

    if state is None:
        state = MasteryState(
            user_id=user.id,
            concept_node_id=body.concept_node_id,
            mastery_score=body.new_mastery,
            attempts_count=0,
            correct_count=0,
        )
        db.add(state)
    else:
        state.mastery_score = round(body.new_mastery, 4)

    await db.commit()
    await db.refresh(state)

    return MasteryStateResponse(
        id=state.id,
        concept_node_id=state.concept_node_id,
        concept_key=node.key,
        concept_name=node.name,
        mastery_score=state.mastery_score,
        attempts_count=state.attempts_count,
        correct_count=state.correct_count,
        last_tested_at=state.last_tested_at,
        updated_at=state.updated_at,
    )


@router.get("/{topic_id}/recommendations", response_model=list[RecommendationResponse])
async def get_topic_recommendations(
    topic_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return concept recommendations sorted by study priority (weakest first).

    Uses cubic power law weighting: (1 - mastery)^3 + epsilon.
    Unstarted concepts default to 0.0 mastery and therefore rank highest.
    """
    recs = await get_recommendations(user_id=user.id, topic_id=topic_id, db=db)
    if not recs:
        raise HTTPException(
            status_code=404, detail="No concept graph for this topic"
        )
    return recs
