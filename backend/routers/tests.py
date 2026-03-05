"""Tests router — generate, grade, and retrieve adaptive tests."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from engines.grading_engine import grade_test
from engines.test_engine import generate_test
from models.database import get_db
from models.test_record import QuestionResult, TestRecord
from models.user import User
from utils.dependencies import get_current_user

router = APIRouter(prefix="/api/tests", tags=["tests"])


# ── Pydantic schemas ──────────────────────────────────────────────────────


class GenerateTestRequest(BaseModel):
    topic_id: int
    num_questions: int = Field(default=5, ge=1, le=20)
    grading_mode: str = Field(default="informal", pattern="^(informal|formal)$")
    session_id: int | None = None


class AnswerItem(BaseModel):
    question_id: int
    answer: str


class GradeTestRequest(BaseModel):
    answers: list[AnswerItem]


class RubricCriterion(BaseModel):
    criterion: str
    points: float
    max: float
    comment: str


class QuestionResultResponse(BaseModel):
    id: int
    test_record_id: int
    concept_node_id: int | None
    question_type: str
    question_text: str
    options: list[str] | None
    correct_answer: str | None
    user_answer: str | None
    score: float | None
    max_score: float | None
    rubric: dict | None
    feedback: str | None
    hints_used: int
    created_at: datetime

    model_config = {"from_attributes": True}


class TestRecordResponse(BaseModel):
    id: int
    user_id: int | None
    topic_id: int | None
    session_id: int | None
    grading_mode: str
    total_score: float | None
    max_score: float | None
    questions_count: int | None
    created_at: datetime
    completed_at: datetime | None
    questions: list[QuestionResultResponse]

    model_config = {"from_attributes": True}


class TestHistoryItem(BaseModel):
    id: int
    grading_mode: str
    total_score: float | None
    max_score: float | None
    questions_count: int | None
    created_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


# ── Helpers ───────────────────────────────────────────────────────────────


async def _load_test_with_questions(
    test_record_id: int, db: AsyncSession
) -> tuple[TestRecord, list[QuestionResult]]:
    """Load a TestRecord + its QuestionResults; raise 404 if not found."""
    result = await db.execute(
        select(TestRecord).where(TestRecord.id == test_record_id)
    )
    test_record = result.scalar_one_or_none()
    if test_record is None:
        raise HTTPException(status_code=404, detail="Test not found")

    qr_result = await db.execute(
        select(QuestionResult).where(QuestionResult.test_record_id == test_record_id)
    )
    questions = list(qr_result.scalars().all())
    return test_record, questions


def _build_test_response(
    test_record: TestRecord, questions: list[QuestionResult]
) -> TestRecordResponse:
    return TestRecordResponse(
        id=test_record.id,
        user_id=test_record.user_id,
        topic_id=test_record.topic_id,
        session_id=test_record.session_id,
        grading_mode=test_record.grading_mode,
        total_score=test_record.total_score,
        max_score=test_record.max_score,
        questions_count=test_record.questions_count,
        created_at=test_record.created_at,
        completed_at=test_record.completed_at,
        questions=[QuestionResultResponse.model_validate(q) for q in questions],
    )


# ── Routes ────────────────────────────────────────────────────────────────


@router.post("/generate", response_model=TestRecordResponse, status_code=201)
async def generate(
    body: GenerateTestRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate an adaptive test for the current user on a given topic.

    Fetches concept nodes and mastery states, then asks GPT to produce
    difficulty-adapted questions. Returns the test with empty answers
    (to be filled in by the frontend during the test-taking flow).
    """
    try:
        test_record = await generate_test(
            topic_id=body.topic_id,
            user_id=user.id,
            db=db,
            num_questions=body.num_questions,
            grading_mode=body.grading_mode,
            session_id=body.session_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    # Use the transient _questions attribute set by generate_test to avoid
    # a second DB round-trip.
    questions: list[QuestionResult] = getattr(test_record, "_questions", [])
    if not questions:
        # Fallback: load from DB
        _, questions = await _load_test_with_questions(test_record.id, db)

    return _build_test_response(test_record, questions)


@router.post("/{test_id}/grade", response_model=TestRecordResponse)
async def grade(
    test_id: int,
    body: GradeTestRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Grade all answers for a completed test.

    Calls GPT to score each subjective question, uses exact-match for MCQ.
    Updates mastery states via the mastery engine. Returns the fully graded
    test with scores, rubrics, and feedback for each question.
    """
    # Verify the test belongs to this user
    record_result = await db.execute(
        select(TestRecord).where(
            TestRecord.id == test_id,
            TestRecord.user_id == user.id,
        )
    )
    if record_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Test not found")

    try:
        test_record = await grade_test(
            test_record_id=test_id,
            answers=[a.model_dump() for a in body.answers],
            user_id=user.id,
            db=db,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    _, questions = await _load_test_with_questions(test_record.id, db)
    return _build_test_response(test_record, questions)


@router.get("/history/{topic_id}", response_model=list[TestHistoryItem])
async def test_history(
    topic_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all tests the current user has taken for a topic, newest first."""
    result = await db.execute(
        select(TestRecord)
        .where(
            TestRecord.user_id == user.id,
            TestRecord.topic_id == topic_id,
        )
        .order_by(TestRecord.created_at.desc())
    )
    records = result.scalars().all()
    return [TestHistoryItem.model_validate(r) for r in records]


@router.get("/{test_id}", response_model=TestRecordResponse)
async def get_test(
    test_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a test and all its question results.

    Returns questions with answers/scores if already graded, or with null
    answer fields if not yet graded.
    """
    # Verify ownership
    record_result = await db.execute(
        select(TestRecord).where(
            TestRecord.id == test_id,
            TestRecord.user_id == user.id,
        )
    )
    test_record = record_result.scalar_one_or_none()
    if test_record is None:
        raise HTTPException(status_code=404, detail="Test not found")

    _, questions = await _load_test_with_questions(test_id, db)
    return _build_test_response(test_record, questions)
