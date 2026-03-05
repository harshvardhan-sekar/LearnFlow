"""Test engine — adaptive test generation with mastery-aware question difficulty."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.concept import ConceptGraph, ConceptNode
from models.mastery import MasteryState
from models.test_record import QuestionResult, TestRecord
from services.llm_client import json_completion

# ── Schemas ───────────────────────────────────────────────────────────────

# These are plain dicts to avoid Pydantic overhead inside the engine layer.
# The router layer validates request/response with Pydantic.


# ── Prompt ────────────────────────────────────────────────────────────────

_TEST_GEN_SYSTEM = """\
You are a test generator for an adaptive learning tool. Your job is to produce
well-formed quiz questions that match the learner's current mastery level.

Rules:
- Mix objective (MCQ with 4 options) and subjective (short answer) question types.
- Higher mastery → harder questions for that concept.
- Lower mastery → easier, foundational questions.
- Each question must be tagged with the concept_key of the concept it tests.
- For MCQ: exactly 4 options, exactly one correct_answer that matches an option exactly.
- For subjective: include an ideal_answer used for grading.
- Difficulty must be one of: easy, medium, hard.
- Return ONLY a JSON object with a "questions" array, nothing else.
"""

_TEST_GEN_USER_TMPL = """\
Generate {num_questions} questions about these concepts (mastery 0.0=none, 1.0=expert):

{concept_list}

Return JSON: {{"questions": [...]}}

Each question object must have:
  question_type: "objective" | "subjective"
  concept_key: string
  difficulty: "easy" | "medium" | "hard"
  question_text: string
  options: [string, string, string, string]  (objective only, null for subjective)
  correct_answer: string
  ideal_answer: string  (model answer used for grading)
"""


# ── Core function ─────────────────────────────────────────────────────────


async def generate_test(
    topic_id: int,
    user_id: int,
    db: AsyncSession,
    num_questions: int = 5,
    grading_mode: str = "informal",
    session_id: int | None = None,
) -> TestRecord:
    """Generate an adaptive test for a user on a topic.

    Fetches concept nodes and the user's mastery states, then calls GPT to
    produce a mix of MCQ and subjective questions adapted to current mastery.
    Persists a TestRecord and the empty QuestionResult rows (user_answer and
    score are filled in during grading).

    Args:
        topic_id: The learning topic to test on.
        user_id: The user being tested.
        db: Async SQLAlchemy session.
        num_questions: How many questions to generate (default 5).
        grading_mode: "informal" or "formal" (stored for later grading).
        session_id: Optional session to associate the test with.

    Returns:
        The persisted TestRecord ORM object (questions accessible via
        the question_results relationship after refresh).

    Raises:
        ValueError: If the topic has no concept graph.
        RuntimeError: If GPT returns malformed JSON.
    """
    # ── 1. Fetch concept nodes ────────────────────────────────────────────
    graph_result = await db.execute(
        select(ConceptGraph).where(ConceptGraph.topic_id == topic_id)
    )
    graph = graph_result.scalar_one_or_none()
    if graph is None:
        raise ValueError(f"No concept graph for topic {topic_id}. Generate one first.")

    nodes_result = await db.execute(
        select(ConceptNode)
        .where(ConceptNode.graph_id == graph.id)
        .order_by(ConceptNode.sort_order)
    )
    nodes: list[ConceptNode] = list(nodes_result.scalars().all())
    if not nodes:
        raise ValueError(f"Concept graph for topic {topic_id} has no nodes.")

    node_by_key: dict[str, ConceptNode] = {n.key: n for n in nodes}

    # ── 2. Fetch mastery states ───────────────────────────────────────────
    node_ids = [n.id for n in nodes]
    mastery_result = await db.execute(
        select(MasteryState).where(
            MasteryState.user_id == user_id,
            MasteryState.concept_node_id.in_(node_ids),
        )
    )
    mastery_by_node_id: dict[int, float] = {
        m.concept_node_id: m.mastery_score
        for m in mastery_result.scalars().all()
    }

    # Build concept list string for the prompt
    concept_lines = []
    for n in nodes:
        mastery = mastery_by_node_id.get(n.id, 0.0)
        concept_lines.append(
            f"- key={n.key!r}, name={n.name!r}, difficulty={n.difficulty!r}, mastery={mastery:.2f}"
        )
    concept_list_str = "\n".join(concept_lines)

    # ── 3. Call GPT ───────────────────────────────────────────────────────
    user_message = _TEST_GEN_USER_TMPL.format(
        num_questions=num_questions,
        concept_list=concept_list_str,
    )
    result = await json_completion(
        messages=[{"role": "user", "content": user_message}],
        system_prompt=_TEST_GEN_SYSTEM,
        temperature=0.4,
        max_tokens=4096,
    )

    raw: Any = result["parsed"]
    questions_raw: list[dict] = raw.get("questions", [])
    if not questions_raw:
        raise RuntimeError("GPT returned no questions. Raw response: " + json.dumps(raw))

    # ── 4. Persist TestRecord ─────────────────────────────────────────────
    test_record = TestRecord(
        user_id=user_id,
        topic_id=topic_id,
        session_id=session_id,
        grading_mode=grading_mode,
        questions_count=len(questions_raw),
    )
    db.add(test_record)
    await db.flush()
    await db.refresh(test_record)

    # ── 5. Persist QuestionResult rows ────────────────────────────────────
    created_questions: list[QuestionResult] = []
    for q in questions_raw:
        concept_key = q.get("concept_key", "")
        node = node_by_key.get(concept_key)
        concept_node_id = node.id if node else None

        qr = QuestionResult(
            test_record_id=test_record.id,
            concept_node_id=concept_node_id,
            question_type=q.get("question_type", "subjective"),
            question_text=q.get("question_text", ""),
            options=q.get("options"),  # list → stored as JSONB
            correct_answer=q.get("correct_answer"),
            max_score=1.0,
            # Store ideal_answer in feedback temporarily (grading engine reads it)
            feedback=q.get("ideal_answer"),
        )
        db.add(qr)
        created_questions.append(qr)

    await db.commit()
    await db.refresh(test_record)

    # Attach the raw questions data so the router can return them without a
    # second round-trip.  We store it as a transient attribute — not in the DB.
    test_record._questions = created_questions  # type: ignore[attr-defined]

    return test_record
