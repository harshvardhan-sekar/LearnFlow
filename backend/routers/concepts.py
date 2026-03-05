"""Concept graph endpoints — generate, retrieve, and list concept nodes."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from engines.concept_extractor import ConceptGraphData, ConceptNodeData, extract_concept_graph
from models.concept import ConceptGraph, ConceptNode
from models.database import get_db
from models.topic import LearningTopic
from models.user import User
from utils.dependencies import get_current_user

router = APIRouter(prefix="/api/concepts", tags=["concepts"])


# ── Response schemas ─────────────────────────────────────────────────────


class ConceptNodeResponse(BaseModel):
    id: int
    graph_id: int
    key: str
    name: str
    description: str | None
    difficulty: str
    prerequisites: list[str] | None
    sort_order: int

    model_config = {"from_attributes": True}


class ConceptGraphResponse(BaseModel):
    id: int
    topic_id: int
    graph_data: dict
    nodes: list[ConceptNodeResponse]

    model_config = {"from_attributes": True}


# ── Helpers ──────────────────────────────────────────────────────────────


async def _get_topic_or_404(topic_id: int, db: AsyncSession) -> LearningTopic:
    result = await db.execute(
        select(LearningTopic).where(LearningTopic.id == topic_id)
    )
    topic = result.scalar_one_or_none()
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic


# ── Routes ───────────────────────────────────────────────────────────────


@router.post("/{topic_id}/generate", response_model=ConceptGraphResponse, status_code=201)
async def generate_concept_graph(
    topic_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a concept graph for a topic using GPT and save to DB.

    Replaces any existing concept graph for this topic.
    """
    topic = await _get_topic_or_404(topic_id, db)

    # Call GPT to extract concept graph
    try:
        graph_data: ConceptGraphData = await extract_concept_graph(
            topic.title, topic.description
        )
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    # Delete existing graph + nodes for this topic (cascade)
    existing = await db.execute(
        select(ConceptGraph).where(ConceptGraph.topic_id == topic_id)
    )
    for old_graph in existing.scalars().all():
        await db.delete(old_graph)
    await db.flush()

    # Save new graph
    cg = ConceptGraph(
        topic_id=topic_id,
        graph_data=graph_data.model_dump(),
    )
    db.add(cg)
    await db.flush()
    await db.refresh(cg)

    # Save nodes
    created_nodes: list[ConceptNode] = []
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
        created_nodes.append(cn)

    await db.commit()
    for cn in created_nodes:
        await db.refresh(cn)

    return ConceptGraphResponse(
        id=cg.id,
        topic_id=cg.topic_id,
        graph_data=cg.graph_data,
        nodes=[ConceptNodeResponse.model_validate(cn) for cn in created_nodes],
    )


@router.get("/{topic_id}", response_model=ConceptGraphResponse)
async def get_concept_graph(
    topic_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the concept graph JSON for a topic."""
    await _get_topic_or_404(topic_id, db)

    result = await db.execute(
        select(ConceptGraph).where(ConceptGraph.topic_id == topic_id)
    )
    cg = result.scalar_one_or_none()
    if cg is None:
        raise HTTPException(status_code=404, detail="No concept graph for this topic")

    nodes_result = await db.execute(
        select(ConceptNode)
        .where(ConceptNode.graph_id == cg.id)
        .order_by(ConceptNode.sort_order)
    )
    nodes = nodes_result.scalars().all()

    return ConceptGraphResponse(
        id=cg.id,
        topic_id=cg.topic_id,
        graph_data=cg.graph_data,
        nodes=[ConceptNodeResponse.model_validate(n) for n in nodes],
    )


@router.get("/{topic_id}/nodes", response_model=list[ConceptNodeResponse])
async def list_concept_nodes(
    topic_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return a flat list of concept nodes for a topic, ordered by sort_order."""
    await _get_topic_or_404(topic_id, db)

    result = await db.execute(
        select(ConceptGraph).where(ConceptGraph.topic_id == topic_id)
    )
    cg = result.scalar_one_or_none()
    if cg is None:
        raise HTTPException(status_code=404, detail="No concept graph for this topic")

    nodes_result = await db.execute(
        select(ConceptNode)
        .where(ConceptNode.graph_id == cg.id)
        .order_by(ConceptNode.sort_order)
    )
    return nodes_result.scalars().all()
