"""Tests for mastery engine (EWA algorithm) and recommendation engine."""

from __future__ import annotations

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from engines.mastery_engine import ALPHA, DIFFICULTY_WEIGHTS, update_mastery, process_question_result
from engines.recommendation_engine import get_focus_weights, get_recommendations
from models.concept import ConceptGraph, ConceptNode
from models.mastery import MasteryState
from models.topic import LearningTopic
from models.user import User


# ── Unit tests: update_mastery (pure function) ────────────────────────────


class TestUpdateMastery:
    def test_first_attempt_easy_correct(self):
        """0.0 mastery, easy correct → 0.2 * 0.3 + 0.8 * 0.0 = 0.06."""
        result = update_mastery(0.0, is_correct=True, difficulty="easy")
        assert result == pytest.approx(0.06, abs=1e-4)

    def test_first_attempt_medium_correct(self):
        """0.0 mastery, medium correct → 0.2 * 0.5 = 0.10."""
        result = update_mastery(0.0, is_correct=True, difficulty="medium")
        assert result == pytest.approx(0.10, abs=1e-4)

    def test_first_attempt_hard_correct(self):
        """0.0 mastery, hard correct → 0.2 * 0.8 = 0.16 (confirmed by arch doc)."""
        result = update_mastery(0.0, is_correct=True, difficulty="hard")
        assert result == pytest.approx(0.16, abs=1e-4)

    def test_high_mastery_hard_correct(self):
        """0.9 mastery, hard correct → 0.2 * 0.8 + 0.8 * 0.9 = 0.88 (confirmed by arch doc)."""
        result = update_mastery(0.9, is_correct=True, difficulty="hard")
        assert result == pytest.approx(0.88, abs=1e-4)

    def test_high_mastery_hard_correct_gain_is_small(self):
        """At 0.9 mastery, a correct hard answer barely moves the needle (EWA momentum)."""
        result = update_mastery(0.9, is_correct=True, difficulty="hard")
        gain = abs(result - 0.9)
        assert gain < 0.05, f"Expected tiny gain at high mastery, got {gain:.4f}"

    def test_incorrect_answer_erodes_mastery(self):
        """Incorrect answer → performance = 0.0, so mastery decays toward 0."""
        result = update_mastery(0.6, is_correct=False, difficulty="medium")
        # 0.2 * 0.0 + 0.8 * 0.6 = 0.48
        assert result == pytest.approx(0.48, abs=1e-4)
        assert result < 0.6

    def test_mastery_clamped_to_one(self):
        """Mastery can never exceed 1.0."""
        result = update_mastery(1.0, is_correct=True, difficulty="hard")
        assert result <= 1.0

    def test_mastery_clamped_to_zero(self):
        """Mastery can never go below 0.0."""
        result = update_mastery(0.0, is_correct=False, difficulty="hard")
        assert result >= 0.0

    def test_unknown_difficulty_defaults_to_medium(self):
        """Unknown difficulty string falls back to 0.5 weight."""
        result_unknown = update_mastery(0.0, is_correct=True, difficulty="extreme")
        result_medium = update_mastery(0.0, is_correct=True, difficulty="medium")
        assert result_unknown == result_medium

    def test_returns_four_decimal_places(self):
        """Result is rounded to 4 decimal places."""
        result = update_mastery(0.333, is_correct=True, difficulty="medium")
        assert result == round(result, 4)


# ── Unit tests: get_focus_weights (pure function) ─────────────────────────


class TestGetFocusWeights:
    def _make_states(self, scores: list[tuple[str, float]]) -> list[dict]:
        return [
            {"concept_key": key, "concept_name": key.upper(), "mastery_score": score}
            for key, score in scores
        ]

    def test_weakest_concept_ranked_first(self):
        states = self._make_states([("B", 0.5), ("A", 0.0), ("C", 0.9)])
        result = get_focus_weights(states)
        assert result[0]["concept_key"] == "A"

    def test_zero_mastery_max_weight(self):
        states = self._make_states([("A", 0.0)])
        result = get_focus_weights(states)
        # (1.0 - 0.0)^3 + 0.01 = 1.01
        assert result[0]["focus_weight"] == pytest.approx(1.01, abs=1e-4)

    def test_half_mastery_weight(self):
        states = self._make_states([("A", 0.5)])
        result = get_focus_weights(states)
        # (0.5)^3 + 0.01 = 0.135
        assert result[0]["focus_weight"] == pytest.approx(0.135, abs=1e-4)

    def test_full_mastery_epsilon_weight(self):
        states = self._make_states([("A", 1.0)])
        result = get_focus_weights(states)
        # (0.0)^3 + 0.01 = 0.01 (EPSILON — never truly zero)
        assert result[0]["focus_weight"] == pytest.approx(0.01, abs=1e-4)

    def test_high_mastery_small_weight(self):
        states = self._make_states([("A", 0.9)])
        result = get_focus_weights(states)
        # (0.1)^3 + 0.01 = 0.011
        assert result[0]["focus_weight"] == pytest.approx(0.011, abs=1e-4)

    def test_sorted_descending(self):
        states = self._make_states([("A", 0.0), ("B", 0.5), ("C", 0.9), ("D", 1.0)])
        result = get_focus_weights(states)
        weights = [r["focus_weight"] for r in result]
        assert weights == sorted(weights, reverse=True)

    def test_empty_returns_empty(self):
        assert get_focus_weights([]) == []

    def test_output_keys(self):
        states = self._make_states([("A", 0.3)])
        result = get_focus_weights(states)
        assert set(result[0].keys()) == {"concept_key", "concept_name", "mastery", "focus_weight"}


# ── Integration tests: process_question_result ────────────────────────────


@pytest.fixture
def topic(db: AsyncSession, test_topic: LearningTopic):
    return test_topic


@pytest_asyncio.fixture
async def concept_node(db: AsyncSession, test_topic: LearningTopic) -> ConceptNode:
    """Create a concept graph + node for the test topic."""
    graph = ConceptGraph(topic_id=test_topic.id, graph_data={})
    db.add(graph)
    await db.flush()
    await db.refresh(graph)

    node = ConceptNode(
        graph_id=graph.id,
        key="test_concept",
        name="Test Concept",
        difficulty="medium",
        sort_order=0,
    )
    db.add(node)
    await db.commit()
    await db.refresh(node)
    return node


@pytest.mark.asyncio
async def test_process_first_attempt_creates_row(
    db: AsyncSession, test_user: User, concept_node: ConceptNode
):
    """First call should create a MasteryState row from baseline 0.0."""
    state = await process_question_result(
        user_id=test_user.id,
        concept_node_id=concept_node.id,
        is_correct=True,
        difficulty="medium",
        db=db,
    )
    assert state.user_id == test_user.id
    assert state.concept_node_id == concept_node.id
    assert state.attempts_count == 1
    assert state.correct_count == 1
    assert state.mastery_score == pytest.approx(0.10, abs=1e-4)
    assert state.last_tested_at is not None


@pytest.mark.asyncio
async def test_process_increments_counts(
    db: AsyncSession, test_user: User, concept_node: ConceptNode
):
    """Second call should update the existing row and increment counts."""
    await process_question_result(
        user_id=test_user.id,
        concept_node_id=concept_node.id,
        is_correct=True,
        difficulty="medium",
        db=db,
    )
    state = await process_question_result(
        user_id=test_user.id,
        concept_node_id=concept_node.id,
        is_correct=False,
        difficulty="medium",
        db=db,
    )
    assert state.attempts_count == 2
    assert state.correct_count == 1  # only one correct


@pytest.mark.asyncio
async def test_process_invalid_node_raises(
    db: AsyncSession, test_user: User
):
    """Non-existent concept_node_id should raise ValueError."""
    with pytest.raises(ValueError, match="ConceptNode 99999 not found"):
        await process_question_result(
            user_id=test_user.id,
            concept_node_id=99999,
            is_correct=True,
            difficulty="easy",
            db=db,
        )


# ── Integration tests: get_recommendations ───────────────────────────────


@pytest_asyncio.fixture
async def three_concepts(
    db: AsyncSession, test_topic: LearningTopic
) -> list[ConceptNode]:
    """Create a concept graph with 3 nodes at varying mastery for testing."""
    graph = ConceptGraph(topic_id=test_topic.id, graph_data={})
    db.add(graph)
    await db.flush()
    await db.refresh(graph)

    nodes = []
    for i, (key, name) in enumerate([("A", "Alpha"), ("B", "Beta"), ("C", "Gamma")]):
        node = ConceptNode(
            graph_id=graph.id, key=key, name=name, difficulty="medium", sort_order=i
        )
        db.add(node)
        nodes.append(node)

    await db.commit()
    for n in nodes:
        await db.refresh(n)
    return nodes


@pytest.mark.asyncio
async def test_recommendations_rank_weakest_first(
    db: AsyncSession, test_user: User, test_topic: LearningTopic, three_concepts: list[ConceptNode]
):
    """Concepts with no mastery data should rank above partially-mastered ones."""
    node_a, node_b, _node_c = three_concepts

    # Give node A high mastery, node B medium mastery; node C untested (0.0 default)
    state_a = MasteryState(
        user_id=test_user.id, concept_node_id=node_a.id,
        mastery_score=0.9, attempts_count=5, correct_count=5,
    )
    state_b = MasteryState(
        user_id=test_user.id, concept_node_id=node_b.id,
        mastery_score=0.5, attempts_count=3, correct_count=2,
    )
    db.add(state_a)
    db.add(state_b)
    await db.commit()

    recs = await get_recommendations(
        user_id=test_user.id, topic_id=test_topic.id, db=db
    )

    assert len(recs) == 3
    # C (0.0) should rank first, then B (0.5), then A (0.9)
    keys_in_order = [r["concept_key"] for r in recs]
    assert keys_in_order == ["C", "B", "A"], f"Expected C, B, A but got {keys_in_order}"


@pytest.mark.asyncio
async def test_recommendations_no_graph_returns_empty(
    db: AsyncSession, test_user: User, test_topic: LearningTopic
):
    """Topic with no concept graph should return empty list."""
    recs = await get_recommendations(
        user_id=test_user.id, topic_id=test_topic.id, db=db
    )
    assert recs == []
