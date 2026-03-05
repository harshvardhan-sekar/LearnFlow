"""Mastery engine — EWA-based per-concept mastery tracking with time decay."""

from __future__ import annotations

from datetime import UTC, datetime
from math import exp

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.concept import ConceptNode
from models.mastery import MasteryState

# ── Algorithm constants ───────────────────────────────────────────────────

ALPHA = 0.2  # EWA learning rate — recent performance gets 20% weight
DECAY_HALF_LIFE_DAYS = 30  # Mastery decays with a 30-day half-life
DIFFICULTY_WEIGHTS: dict[str, float] = {"easy": 0.3, "medium": 0.5, "hard": 0.8}


# ── Core algorithm ────────────────────────────────────────────────────────


def update_mastery(
    current_mastery: float,
    is_correct: bool,
    difficulty: str,
    last_tested_at: datetime | None = None,
) -> float:
    """EWA-based mastery update with time decay.

    - Recent performance weighted by ALPHA (momentum effect)
    - Time decay models Ebbinghaus forgetting curve (30-day half-life)
    - Difficulty affects the weight of each observation

    Args:
        current_mastery: Current mastery score in [0.0, 1.0].
        is_correct: Whether the student answered correctly.
        difficulty: Question difficulty — "easy", "medium", or "hard".
        last_tested_at: When this concept was last tested (for decay). Pass
            None to skip decay (e.g. first attempt or unknown).

    Returns:
        Updated mastery score clamped to [0.0, 1.0], rounded to 4 decimal places.
    """
    question_weight = DIFFICULTY_WEIGHTS.get(difficulty, 0.5)

    # Performance signal: difficulty-weighted for correct, 0.0 for incorrect
    performance = question_weight if is_correct else 0.0

    # Apply time decay if we know when they were last tested
    decayed_mastery = current_mastery
    if last_tested_at is not None:
        # Normalize naive datetimes (stored as UTC in DB) to aware for subtraction
        aware_last = (
            last_tested_at.replace(tzinfo=UTC)
            if last_tested_at.tzinfo is None
            else last_tested_at
        )
        days_since = (datetime.now(UTC) - aware_last).total_seconds() / 86400
        decay_factor = exp(-0.693 * days_since / DECAY_HALF_LIFE_DAYS)  # ln(2) ≈ 0.693
        decayed_mastery = current_mastery * decay_factor

    # EWA update: blend recent performance with decayed history
    new_mastery = ALPHA * performance + (1 - ALPHA) * decayed_mastery
    return round(max(0.0, min(1.0, new_mastery)), 4)


# ── DB layer ──────────────────────────────────────────────────────────────


async def process_question_result(
    user_id: int,
    concept_node_id: int,
    is_correct: bool,
    difficulty: str,
    db: AsyncSession,
) -> MasteryState:
    """Update mastery after a test question result and persist to DB.

    Performs an upsert on mastery_states: creates the row if it doesn't exist,
    updates it if it does. Also increments attempts_count and correct_count.

    Args:
        user_id: The user's integer PK.
        concept_node_id: The concept node's integer PK.
        is_correct: Whether the student answered correctly.
        difficulty: Question difficulty — "easy", "medium", or "hard".
        db: Async SQLAlchemy session.

    Returns:
        The updated (or newly created) MasteryState ORM object.

    Raises:
        ValueError: If the concept_node_id does not exist.
    """
    # Verify concept node exists
    node_result = await db.execute(
        select(ConceptNode).where(ConceptNode.id == concept_node_id)
    )
    node = node_result.scalar_one_or_none()
    if node is None:
        raise ValueError(f"ConceptNode {concept_node_id} not found")

    # Fetch existing mastery state (or None)
    state_result = await db.execute(
        select(MasteryState).where(
            MasteryState.user_id == user_id,
            MasteryState.concept_node_id == concept_node_id,
        )
    )
    state = state_result.scalar_one_or_none()

    if state is None:
        # First attempt — create from baseline 0.0
        new_score = update_mastery(0.0, is_correct, difficulty, last_tested_at=None)
        state = MasteryState(
            user_id=user_id,
            concept_node_id=concept_node_id,
            mastery_score=new_score,
            attempts_count=1,
            correct_count=1 if is_correct else 0,
            last_tested_at=datetime.now(UTC),
        )
        db.add(state)
    else:
        # Subsequent attempt — apply EWA with time decay
        new_score = update_mastery(
            state.mastery_score, is_correct, difficulty, state.last_tested_at
        )
        state.mastery_score = new_score
        state.attempts_count += 1
        if is_correct:
            state.correct_count += 1
        state.last_tested_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(state)
    return state
