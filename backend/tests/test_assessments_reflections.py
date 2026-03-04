"""Tests for assessments and reflections routers."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from models.session import Session
from models.topic import LearningTopic
from models.user import User

pytestmark = pytest.mark.asyncio


# ── Assessment tests ─────────────────────────────────────────────────────

MOCK_QUESTIONS = {
    "parsed": {
        "questions": [
            {
                "question": "What is supervised learning?",
                "options": [
                    "Learning with labeled data",
                    "Learning without labels",
                    "Reinforcement learning",
                    "Transfer learning",
                ],
                "correct_index": 0,
            },
            {
                "question": "Which is a classification algorithm?",
                "options": [
                    "Linear regression",
                    "K-means clustering",
                    "Logistic regression",
                    "PCA",
                ],
                "correct_index": 2,
            },
            {
                "question": "What does overfitting mean?",
                "options": [
                    "Model performs well on all data",
                    "Model memorizes training data and fails on new data",
                    "Model is too simple",
                    "Model has high bias",
                ],
                "correct_index": 1,
            },
        ]
    },
    "tokens_used": 500,
}


@patch("routers.assessments.json_completion", new_callable=AsyncMock, return_value=MOCK_QUESTIONS)
async def test_create_assessment_and_submit(
    mock_llm,
    client: AsyncClient,
    test_session: Session,
):
    """Create a pre-assessment, submit answers, verify auto-grading."""
    # 1. Create assessment
    resp = await client.post("/api/assessments/", json={
        "session_id": test_session.id,
        "assessment_type": "pre",
    })
    assert resp.status_code == 201
    data = resp.json()
    assessment_id = data["id"]
    assert data["assessment_type"] == "pre"
    assert data["session_id"] == test_session.id
    assert len(data["questions"]["questions"]) == 3
    assert data["answers"] is None
    assert data["score"] is None
    assert data["completed_at"] is None

    # 2. Submit correct answers (indices 0, 2, 1 — all correct)
    resp = await client.put(f"/api/assessments/{assessment_id}", json={
        "answers": {"0": 0, "1": 2, "2": 1},
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["score"] == 3.0
    assert data["max_score"] == 3.0
    assert data["completed_at"] is not None
    assert data["answers"] == {"0": 0, "1": 2, "2": 1}


@patch("routers.assessments.json_completion", new_callable=AsyncMock, return_value=MOCK_QUESTIONS)
async def test_assessment_partial_score(
    mock_llm,
    client: AsyncClient,
    test_session: Session,
):
    """Submit partially correct answers, verify partial score."""
    resp = await client.post("/api/assessments/", json={
        "session_id": test_session.id,
        "assessment_type": "post",
    })
    assert resp.status_code == 201
    assessment_id = resp.json()["id"]

    # Answer: first correct (0), second wrong (0 instead of 2), third correct (1)
    resp = await client.put(f"/api/assessments/{assessment_id}", json={
        "answers": {"0": 0, "1": 0, "2": 1},
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["score"] == 2.0
    assert data["max_score"] == 3.0


@patch("routers.assessments.json_completion", new_callable=AsyncMock, return_value=MOCK_QUESTIONS)
async def test_assessment_no_double_submit(
    mock_llm,
    client: AsyncClient,
    test_session: Session,
):
    """Cannot submit answers twice."""
    resp = await client.post("/api/assessments/", json={
        "session_id": test_session.id,
        "assessment_type": "pre",
    })
    assessment_id = resp.json()["id"]

    await client.put(f"/api/assessments/{assessment_id}", json={
        "answers": {"0": 0, "1": 2, "2": 1},
    })
    resp = await client.put(f"/api/assessments/{assessment_id}", json={
        "answers": {"0": 1, "1": 1, "2": 1},
    })
    assert resp.status_code == 400


@patch("routers.assessments.json_completion", new_callable=AsyncMock, return_value=MOCK_QUESTIONS)
async def test_get_assessments(
    mock_llm,
    client: AsyncClient,
    test_session: Session,
):
    """GET /api/assessments/{session_id} returns all assessments."""
    await client.post("/api/assessments/", json={
        "session_id": test_session.id,
        "assessment_type": "pre",
    })
    await client.post("/api/assessments/", json={
        "session_id": test_session.id,
        "assessment_type": "post",
    })

    resp = await client.get(f"/api/assessments/{test_session.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    types = {a["assessment_type"] for a in data}
    assert types == {"pre", "post"}


async def test_create_assessment_invalid_type(
    client: AsyncClient,
    test_session: Session,
):
    """Reject assessment_type other than pre/post."""
    resp = await client.post("/api/assessments/", json={
        "session_id": test_session.id,
        "assessment_type": "midterm",
    })
    assert resp.status_code == 422


# ── Reflection tests ─────────────────────────────────────────────────────


async def test_create_and_get_reflection(
    client: AsyncClient,
    test_session: Session,
):
    """Submit a reflection, then retrieve it."""
    resp = await client.post("/api/reflections/", json={
        "session_id": test_session.id,
        "reflection_text": "I learned a lot about supervised learning today.",
        "confidence_rating": 4,
        "difficulty_rating": 3,
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["reflection_text"] == "I learned a lot about supervised learning today."
    assert data["confidence_rating"] == 4
    assert data["difficulty_rating"] == 3
    assert data["session_id"] == test_session.id

    # Retrieve
    resp = await client.get(f"/api/reflections/{test_session.id}")
    assert resp.status_code == 200
    reflections = resp.json()
    assert len(reflections) == 1
    assert reflections[0]["reflection_text"] == "I learned a lot about supervised learning today."


async def test_reflection_rating_validation(
    client: AsyncClient,
    test_session: Session,
):
    """Ratings must be 1-5."""
    resp = await client.post("/api/reflections/", json={
        "session_id": test_session.id,
        "reflection_text": "Test",
        "confidence_rating": 0,
        "difficulty_rating": 3,
    })
    assert resp.status_code == 422

    resp = await client.post("/api/reflections/", json={
        "session_id": test_session.id,
        "reflection_text": "Test",
        "confidence_rating": 3,
        "difficulty_rating": 6,
    })
    assert resp.status_code == 422


async def test_reflection_invalid_session(
    client: AsyncClient,
):
    """Reflection for nonexistent session returns 404."""
    resp = await client.post("/api/reflections/", json={
        "session_id": 99999,
        "reflection_text": "Test",
        "confidence_rating": 3,
        "difficulty_rating": 3,
    })
    assert resp.status_code == 404
