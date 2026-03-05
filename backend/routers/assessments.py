"""Assessments router — GPT-generated pre/post assessments with auto-grading."""

import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.assessment import Assessment
from models.concept import ConceptGraph, ConceptNode
from models.database import get_db
from models.mastery import MasteryState
from models.session import Session
from models.topic import LearningTopic
from models.user import User
from services.llm_client import json_completion
from utils.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/assessments", tags=["assessments"])


# ── Schemas ──────────────────────────────────────────────────────────────


class AssessmentCreate(BaseModel):
    session_id: int
    assessment_type: str  # "pre" or "post"


class AssessmentSubmit(BaseModel):
    answers: dict  # {question_index: selected_option_index} or {question_index: answer_text}


class AssessmentResponse(BaseModel):
    id: int
    session_id: int
    user_id: int | None
    assessment_type: str
    questions: dict
    answers: dict | None
    score: float | None
    max_score: float | None
    created_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


# ── Helpers ──────────────────────────────────────────────────────────────


async def _get_own_session_or_404(
    session_id: int, user: User, db: AsyncSession
) -> Session:
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your session")
    return session


ASSESSMENT_SYSTEM_PROMPT = """\
You are a learning assessment generator. Generate multiple-choice questions to test \
a student's understanding of a topic.

Return a JSON object with a single key "questions" containing an array of question objects.
Each question object must have:
- "question": the question text
- "options": array of exactly 4 option strings
- "correct_index": integer index (0-3) of the correct option

Generate 3 to 5 questions that range from basic recall to conceptual understanding.
"""


async def _generate_questions(topic_title: str, assessment_type: str) -> list[dict]:
    """Use GPT to generate MCQ assessment questions about the topic."""
    user_msg = (
        f"Generate a {assessment_type}-session assessment for the topic: {topic_title}\n\n"
        f"This is a {'pre' if assessment_type == 'pre' else 'post'}-session assessment, "
        f"so {'focus on baseline knowledge' if assessment_type == 'pre' else 'test deeper understanding gained during the session'}."
    )
    result = await json_completion(
        messages=[{"role": "user", "content": user_msg}],
        system_prompt=ASSESSMENT_SYSTEM_PROMPT,
        temperature=0.4,
    )
    parsed = result["parsed"]
    questions = parsed.get("questions", [])
    if not questions:
        raise HTTPException(status_code=500, detail="Failed to generate assessment questions")
    return questions


async def _init_mastery_from_assessment(
    user_id: int,
    session_id: int,
    score_pct: float,
    db: AsyncSession,
) -> None:
    """Set initial mastery for all concept nodes based on pre-assessment score.

    The pre-assessment score provides a rough baseline. We apply a scaled
    initial mastery: easy concepts get (score_pct * 0.8), medium (score_pct * 0.5),
    hard concepts get (score_pct * 0.3). Only creates mastery rows if they
    don't already exist.
    """
    # Find the topic from the session
    session_result = await db.execute(
        select(Session).where(Session.id == session_id)
    )
    session = session_result.scalar_one_or_none()
    if session is None or session.topic_id is None:
        return

    # Find concept graph for the topic
    cg_result = await db.execute(
        select(ConceptGraph).where(ConceptGraph.topic_id == session.topic_id)
    )
    cg = cg_result.scalar_one_or_none()
    if cg is None:
        return  # No concept graph yet

    # Get all concept nodes
    nodes_result = await db.execute(
        select(ConceptNode).where(ConceptNode.graph_id == cg.id)
    )
    nodes = nodes_result.scalars().all()
    if not nodes:
        return

    difficulty_scale = {"easy": 0.8, "medium": 0.5, "hard": 0.3}
    now = datetime.now(UTC)

    for node in nodes:
        # Check if mastery already exists
        existing = await db.execute(
            select(MasteryState).where(
                MasteryState.user_id == user_id,
                MasteryState.concept_node_id == node.id,
            )
        )
        if existing.scalar_one_or_none() is not None:
            continue  # Don't overwrite existing mastery

        scale = difficulty_scale.get(node.difficulty, 0.5)
        initial_mastery = round(score_pct * scale, 4)

        db.add(MasteryState(
            user_id=user_id,
            concept_node_id=node.id,
            mastery_score=initial_mastery,
            attempts_count=1,
            correct_count=1 if score_pct >= 0.5 else 0,
            last_tested_at=now,
        ))

    await db.commit()
    logger.info(
        "Initialized mastery for %d concepts from pre-assessment (%.0f%%)",
        len(nodes),
        score_pct * 100,
    )


def _grade_assessment(questions: list[dict], answers: dict) -> tuple[float, float]:
    """Auto-grade MCQ answers. Returns (score, max_score)."""
    max_score = float(len(questions))
    score = 0.0
    for idx, q in enumerate(questions):
        user_answer = answers.get(str(idx))
        if user_answer is None:
            continue
        try:
            if int(user_answer) == q.get("correct_index"):
                score += 1.0
        except (ValueError, TypeError):
            continue
    return score, max_score


# ── Routes ───────────────────────────────────────────────────────────────


@router.post("", response_model=AssessmentResponse, status_code=201)
async def create_assessment(
    body: AssessmentCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a pre or post assessment — generates questions via GPT."""
    if body.assessment_type not in ("pre", "post"):
        raise HTTPException(status_code=422, detail="assessment_type must be 'pre' or 'post'")

    session = await _get_own_session_or_404(body.session_id, user, db)

    # Get topic title for question generation
    topic_title = "General Knowledge"
    if session.topic_id:
        result = await db.execute(
            select(LearningTopic).where(LearningTopic.id == session.topic_id)
        )
        topic = result.scalar_one_or_none()
        if topic:
            topic_title = topic.title

    questions = await _generate_questions(topic_title, body.assessment_type)

    assessment = Assessment(
        session_id=body.session_id,
        user_id=user.id,
        assessment_type=body.assessment_type,
        questions={"questions": questions},
    )
    db.add(assessment)
    await db.commit()
    await db.refresh(assessment)
    return assessment


@router.put("/{assessment_id}", response_model=AssessmentResponse)
async def submit_answers(
    assessment_id: int,
    body: AssessmentSubmit,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit answers for an assessment and auto-grade MCQ questions."""
    result = await db.execute(
        select(Assessment).where(Assessment.id == assessment_id)
    )
    assessment = result.scalar_one_or_none()
    if assessment is None:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if assessment.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your assessment")
    if assessment.completed_at is not None:
        raise HTTPException(status_code=400, detail="Assessment already submitted")

    questions = assessment.questions.get("questions", [])
    score, max_score = _grade_assessment(questions, body.answers)

    assessment.answers = body.answers
    assessment.score = score
    assessment.max_score = max_score
    assessment.completed_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(assessment)

    # ── Initialize concept mastery from pre-assessment score ────────────
    if assessment.assessment_type == "pre" and max_score > 0:
        try:
            await _init_mastery_from_assessment(
                user_id=user.id,
                session_id=assessment.session_id,
                score_pct=score / max_score,
                db=db,
            )
        except Exception:
            logger.exception("Failed to init mastery from pre-assessment")

    return assessment


@router.get("/{session_id}", response_model=list[AssessmentResponse])
async def get_assessments(
    session_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all assessments for a session."""
    await _get_own_session_or_404(session_id, user, db)
    result = await db.execute(
        select(Assessment)
        .where(Assessment.session_id == session_id, Assessment.user_id == user.id)
        .order_by(Assessment.created_at)
    )
    return result.scalars().all()
