"""Grading engine — dual-mode (informal / formal) answer evaluation with rubrics."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from engines.mastery_engine import process_question_result
from models.concept import ConceptNode
from models.test_record import QuestionResult, TestRecord
from services.llm_client import json_completion

# ── Prompts ───────────────────────────────────────────────────────────────

_INFORMAL_SYSTEM = """\
You are a friendly tutor grading a student's answer. Focus on whether they
understand the CORE CONCEPT, not on exact wording or terminology.

Grade on a scale of 0 to the given max_score. Be generous with partial credit if:
- The main idea is present, even if terminology is imprecise.
- The student demonstrates understanding, even if the explanation is informal.
- Key concepts are referenced, even if the structure is non-academic.

Return ONLY a JSON object — no markdown, no prose.
"""

_INFORMAL_USER_TMPL = """\
Question: {question_text}
Max score: {max_score}
Ideal Answer: {ideal_answer}
Student's Answer: {user_answer}

Return JSON:
{{
  "score": <number 0-{max_score}>,
  "max_score": {max_score},
  "confidence": <0.0-1.0>,
  "rubric": [
    {{"criterion": "Core Concept Understanding", "points": <n>, "max": <n>, "comment": "..."}},
    {{"criterion": "Key Details", "points": <n>, "max": <n>, "comment": "..."}}
  ],
  "feedback": "Overall feedback for the student",
  "sources": [],
  "citations": []
}}
"""

_FORMAL_SYSTEM = """\
You are an academic evaluator grading with precision. Evaluate strictly for:
- Exact terminology and definitions
- Completeness of explanation
- Logical structure and reasoning
- Correct use of domain-specific language

Deduct points for imprecise terminology, missing key components, logical gaps,
or vague language. Return ONLY a JSON object — no markdown, no prose.
"""

_FORMAL_USER_TMPL = """\
Question: {question_text}
Max score: {max_score}
Ideal Answer: {ideal_answer}
Student's Answer: {user_answer}

Return JSON:
{{
  "score": <number 0-{max_score}>,
  "max_score": {max_score},
  "rubric": [
    {{"criterion": "Terminology Precision", "points": <n>, "max": <n>, "comment": "..."}},
    {{"criterion": "Completeness", "points": <n>, "max": <n>, "comment": "..."}},
    {{"criterion": "Logical Reasoning", "points": <n>, "max": <n>, "comment": "..."}},
    {{"criterion": "Academic Rigor", "points": <n>, "max": <n>, "comment": "..."}}
  ],
  "feedback": "Detailed academic feedback",
  "sources": [],
  "citations": []
}}
"""

# Confidence threshold below which informal grading is flagged for manual review
_CONFIDENCE_THRESHOLD = 0.7


# ── grade_answer ──────────────────────────────────────────────────────────


async def grade_answer(
    question_text: str,
    ideal_answer: str,
    user_answer: str,
    grading_mode: str,
    max_score: float = 1.0,
    question_type: str = "subjective",
    correct_answer: str | None = None,
    options: list[str] | None = None,
) -> dict[str, Any]:
    """Grade a single answer using GPT.

    For objective (MCQ) questions, scoring is deterministic (exact match).
    For subjective questions, GPT grades with the chosen mode's rubric.

    Args:
        question_text: The question prompt shown to the user.
        ideal_answer: Model answer used to anchor grading.
        user_answer: What the student actually wrote/selected.
        grading_mode: "informal" or "formal".
        max_score: Maximum possible score (default 1.0).
        question_type: "objective" or "subjective".
        correct_answer: The correct option for MCQ (required when objective).
        options: The MCQ option list (used for display only).

    Returns:
        Dict with keys: score, max_score, rubric, feedback, sources, citations,
        and optionally confidence (informal mode) and low_confidence (bool).
    """
    # ── MCQ: deterministic grading ─────────────────────────────────────
    if question_type == "objective" and correct_answer is not None:
        is_correct = (user_answer or "").strip() == correct_answer.strip()
        score = max_score if is_correct else 0.0
        rubric = [
            {
                "criterion": "Correct Answer",
                "points": score,
                "max": max_score,
                "comment": "Correct." if is_correct else f"Incorrect. The correct answer is: {correct_answer}",
            }
        ]
        return {
            "score": score,
            "max_score": max_score,
            "confidence": 1.0,
            "low_confidence": False,
            "rubric": rubric,
            "feedback": "Correct!" if is_correct else f"The correct answer was: {correct_answer}",
            "sources": [],
            "citations": [],
        }

    # ── Subjective: GPT grading ────────────────────────────────────────
    if grading_mode == "formal":
        system = _FORMAL_SYSTEM
        user_msg = _FORMAL_USER_TMPL.format(
            question_text=question_text,
            max_score=max_score,
            ideal_answer=ideal_answer,
            user_answer=user_answer or "(no answer provided)",
        )
    else:
        system = _INFORMAL_SYSTEM
        user_msg = _INFORMAL_USER_TMPL.format(
            question_text=question_text,
            max_score=max_score,
            ideal_answer=ideal_answer,
            user_answer=user_answer or "(no answer provided)",
        )

    result = await json_completion(
        messages=[{"role": "user", "content": user_msg}],
        system_prompt=system,
        temperature=0.2,
        max_tokens=1024,
    )
    parsed: dict[str, Any] = result["parsed"]

    # Clamp score to [0, max_score]
    raw_score = float(parsed.get("score", 0.0))
    clamped_score = round(max(0.0, min(max_score, raw_score)), 4)
    parsed["score"] = clamped_score
    parsed.setdefault("max_score", max_score)
    parsed.setdefault("rubric", [])
    parsed.setdefault("feedback", "")
    parsed.setdefault("sources", [])
    parsed.setdefault("citations", [])

    # Confidence + low_confidence flag (informal mode only)
    confidence = float(parsed.get("confidence", 1.0))
    low_confidence = grading_mode == "informal" and confidence < _CONFIDENCE_THRESHOLD
    parsed["confidence"] = confidence
    parsed["low_confidence"] = low_confidence

    return parsed


# ── grade_test ────────────────────────────────────────────────────────────


async def grade_test(
    test_record_id: int,
    answers: list[dict[str, Any]],
    user_id: int,
    db: AsyncSession,
) -> TestRecord:
    """Grade all answers for a test, update mastery, and persist scores.

    For each answer:
    1. Loads the QuestionResult (which holds the ideal_answer in `feedback`
       and the question metadata).
    2. Calls grade_answer to get GPT scoring.
    3. Updates the QuestionResult row with score/rubric/feedback.
    4. Calls mastery_engine.process_question_result for EWA mastery update.

    Finally, sums scores and marks the TestRecord as completed.

    Args:
        test_record_id: PK of the TestRecord to grade.
        answers: List of dicts with {question_id: int, answer: str}.
        user_id: The user being graded (for mastery update).
        db: Async SQLAlchemy session.

    Returns:
        The updated TestRecord ORM object.

    Raises:
        ValueError: If the TestRecord is not found.
    """
    # Load test record
    record_result = await db.execute(
        select(TestRecord).where(TestRecord.id == test_record_id)
    )
    test_record = record_result.scalar_one_or_none()
    if test_record is None:
        raise ValueError(f"TestRecord {test_record_id} not found")

    grading_mode = test_record.grading_mode

    # Build answer map {question_id → answer_text}
    answer_map: dict[int, str] = {
        int(a["question_id"]): str(a.get("answer") or "") for a in answers
    }

    # Load all question results for this test
    qr_result = await db.execute(
        select(QuestionResult).where(QuestionResult.test_record_id == test_record_id)
    )
    question_results: list[QuestionResult] = list(qr_result.scalars().all())

    total_score = 0.0
    max_total = 0.0

    for qr in question_results:
        user_answer = answer_map.get(qr.id, "")
        ideal_answer = qr.feedback or ""  # stored in feedback column during generation
        max_score = qr.max_score or 1.0

        graded = await grade_answer(
            question_text=qr.question_text,
            ideal_answer=ideal_answer,
            user_answer=user_answer,
            grading_mode=grading_mode,
            max_score=max_score,
            question_type=qr.question_type,
            correct_answer=qr.correct_answer,
            options=qr.options if isinstance(qr.options, list) else None,
        )

        score = graded["score"]
        total_score += score
        max_total += max_score

        # Update QuestionResult
        qr.user_answer = user_answer
        qr.score = score
        qr.max_score = max_score
        qr.rubric = {
            "criteria": graded.get("rubric", []),
            "confidence": graded.get("confidence", 1.0),
            "low_confidence": graded.get("low_confidence", False),
            "sources": graded.get("sources", []),
            "citations": graded.get("citations", []),
        }
        # Overwrite feedback with actual grading feedback (ideal_answer purpose is served)
        qr.feedback = graded.get("feedback", "")

        # ── Mastery update ────────────────────────────────────────────
        if qr.concept_node_id is not None:
            # Determine difficulty from concept node
            node_result = await db.execute(
                select(ConceptNode).where(ConceptNode.id == qr.concept_node_id)
            )
            node = node_result.scalar_one_or_none()
            difficulty = node.difficulty if node else "medium"

            is_correct = score >= (max_score * 0.5)
            try:
                await process_question_result(
                    user_id=user_id,
                    concept_node_id=qr.concept_node_id,
                    is_correct=is_correct,
                    difficulty=difficulty,
                    db=db,
                )
            except ValueError:
                pass  # concept node was deleted; skip mastery update

    # Update test record totals
    test_record.total_score = round(total_score, 4)
    test_record.max_score = round(max_total, 4)
    test_record.completed_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(test_record)
    return test_record
