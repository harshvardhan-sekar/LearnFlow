"""Topics CRUD router."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from models.subject import Subject
from models.topic import LearningTopic
from models.user import User
from utils.dependencies import get_current_user

router = APIRouter(prefix="/api/topics", tags=["topics"])


# ── Schemas ──────────────────────────────────────────────────────────────

class TopicCreate(BaseModel):
    title: str
    description: str | None = None
    subject_id: int | None = None
    estimated_sessions: int = 8


class TopicResponse(BaseModel):
    id: int
    subject_id: int | None
    title: str
    description: str | None
    estimated_sessions: int
    created_by: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Routes ───────────────────────────────────────────────────────────────

@router.post("", response_model=TopicResponse, status_code=201)
async def create_topic(
    body: TopicCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.subject_id is not None:
        subj_result = await db.execute(
            select(Subject).where(Subject.id == body.subject_id)
        )
        if subj_result.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Subject not found")

    topic = LearningTopic(
        title=body.title,
        description=body.description,
        subject_id=body.subject_id,
        estimated_sessions=body.estimated_sessions,
        created_by=user.id,
    )
    db.add(topic)
    await db.commit()
    await db.refresh(topic)
    return topic


@router.get("", response_model=list[TopicResponse])
async def list_topics(
    subject_id: int | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(LearningTopic).order_by(LearningTopic.created_at.desc())
    if subject_id is not None:
        stmt = stmt.where(LearningTopic.subject_id == subject_id)
    rows = await db.execute(stmt)
    return rows.scalars().all()


@router.get("/{topic_id}", response_model=TopicResponse)
async def get_topic(
    topic_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LearningTopic).where(LearningTopic.id == topic_id)
    )
    topic = result.scalar_one_or_none()
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic
