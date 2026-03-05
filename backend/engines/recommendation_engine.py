"""Recommendation engine — cubic power law focus weighting for concept study priority."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.concept import ConceptGraph, ConceptNode
from models.mastery import MasteryState

# ── Algorithm constants ───────────────────────────────────────────────────

EPSILON = 0.01  # Prevents fully-mastered concepts from having zero focus weight


# ── Core algorithm ────────────────────────────────────────────────────────


def get_focus_weights(mastery_states: list[dict]) -> list[dict]:
    """Cubic power law: lower mastery = exponentially higher focus weight.

    Weights:
        0.0 mastery → 1.01  (maximum priority)
        0.5 mastery → 0.135
        0.9 mastery → 0.011
        1.0 mastery → 0.01  (EPSILON — never truly zero)

    Args:
        mastery_states: List of dicts with keys:
            - concept_key (str)
            - concept_name (str)
            - mastery_score (float, 0.0–1.0)

    Returns:
        Same list augmented with "mastery" and "focus_weight" fields,
        sorted by focus_weight descending (weakest concepts first).
    """
    weighted = []
    for state in mastery_states:
        weight = (1.0 - state["mastery_score"]) ** 3 + EPSILON
        weighted.append(
            {
                "concept_key": state["concept_key"],
                "concept_name": state["concept_name"],
                "mastery": state["mastery_score"],
                "focus_weight": round(weight, 4),
            }
        )

    weighted.sort(key=lambda x: x["focus_weight"], reverse=True)
    return weighted


# ── DB layer ──────────────────────────────────────────────────────────────


async def get_recommendations(
    user_id: int,
    topic_id: int,
    db: AsyncSession,
) -> list[dict]:
    """Return concept recommendations sorted by study priority for a user/topic.

    Fetches all concept nodes for the topic, loads any existing mastery states
    (defaulting unstarted concepts to 0.0), then applies the cubic power law
    to rank them weakest-first.

    Args:
        user_id: The user's integer PK.
        topic_id: The learning topic's integer PK.
        db: Async SQLAlchemy session.

    Returns:
        List of dicts with keys: concept_key, concept_name, mastery, focus_weight.
        Empty list if no concept graph exists for the topic.
    """
    # Get the concept graph for this topic
    graph_result = await db.execute(
        select(ConceptGraph).where(ConceptGraph.topic_id == topic_id)
    )
    graph = graph_result.scalar_one_or_none()
    if graph is None:
        return []

    # Get all concept nodes ordered by sort_order
    nodes_result = await db.execute(
        select(ConceptNode)
        .where(ConceptNode.graph_id == graph.id)
        .order_by(ConceptNode.sort_order)
    )
    nodes = nodes_result.scalars().all()
    if not nodes:
        return []

    node_ids = [n.id for n in nodes]

    # Load mastery states for this user + these nodes
    mastery_result = await db.execute(
        select(MasteryState).where(
            MasteryState.user_id == user_id,
            MasteryState.concept_node_id.in_(node_ids),
        )
    )
    mastery_by_node_id = {
        ms.concept_node_id: ms.mastery_score
        for ms in mastery_result.scalars().all()
    }

    # Build mastery_states input for get_focus_weights, defaulting to 0.0
    states = [
        {
            "concept_key": node.key,
            "concept_name": node.name,
            "mastery_score": mastery_by_node_id.get(node.id, 0.0),
        }
        for node in nodes
    ]

    return get_focus_weights(states)
