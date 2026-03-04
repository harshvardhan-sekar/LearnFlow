"""Subjects CRUD router."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from models.subject import Subject
from models.topic import LearningTopic
from models.user import User
from utils.dependencies import get_current_user

router = APIRouter(prefix="/api/subjects", tags=["subjects"])


# ── Schemas ──────────────────────────────────────────────────────────────

class SubjectCreate(BaseModel):
    title: str
    description: str | None = None


class SubjectUpdate(BaseModel):
    title: str | None = None
    description: str | None = None


class SubjectResponse(BaseModel):
    id: int
    user_id: int | None
    title: str
    description: str | None
    created_at: datetime
    topic_count: int = 0

    model_config = {"from_attributes": True}


# ── Routes ───────────────────────────────────────────────────────────────

@router.post("/", response_model=SubjectResponse, status_code=201)
async def create_subject(
    body: SubjectCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    subject = Subject(title=body.title, description=body.description, user_id=user.id)
    db.add(subject)
    await db.commit()
    await db.refresh(subject)
    return SubjectResponse(
        id=subject.id,
        user_id=subject.user_id,
        title=subject.title,
        description=subject.description,
        created_at=subject.created_at,
        topic_count=0,
    )


@router.get("/", response_model=list[SubjectResponse])
async def list_subjects(db: AsyncSession = Depends(get_db)):
    """List all subjects with their topic counts."""
    stmt = (
        select(
            Subject,
            func.count(LearningTopic.id).label("topic_count"),
        )
        .outerjoin(LearningTopic, LearningTopic.subject_id == Subject.id)
        .group_by(Subject.id)
        .order_by(Subject.created_at.desc())
    )
    rows = (await db.execute(stmt)).all()
    return [
        SubjectResponse(
            id=subj.id,
            user_id=subj.user_id,
            title=subj.title,
            description=subj.description,
            created_at=subj.created_at,
            topic_count=count,
        )
        for subj, count in rows
    ]


@router.get("/{subject_id}", response_model=SubjectResponse)
async def get_subject(subject_id: int, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(
            Subject,
            func.count(LearningTopic.id).label("topic_count"),
        )
        .outerjoin(LearningTopic, LearningTopic.subject_id == Subject.id)
        .where(Subject.id == subject_id)
        .group_by(Subject.id)
    )
    row = (await db.execute(stmt)).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Subject not found")
    subj, count = row
    return SubjectResponse(
        id=subj.id,
        user_id=subj.user_id,
        title=subj.title,
        description=subj.description,
        created_at=subj.created_at,
        topic_count=count,
    )


@router.put("/{subject_id}", response_model=SubjectResponse)
async def update_subject(
    subject_id: int,
    body: SubjectUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    subject = result.scalar_one_or_none()
    if subject is None:
        raise HTTPException(status_code=404, detail="Subject not found")

    if body.title is not None:
        subject.title = body.title
    if body.description is not None:
        subject.description = body.description

    await db.commit()
    await db.refresh(subject)

    # Get topic count
    count_result = await db.execute(
        select(func.count(LearningTopic.id)).where(
            LearningTopic.subject_id == subject_id
        )
    )
    topic_count = count_result.scalar() or 0

    return SubjectResponse(
        id=subject.id,
        user_id=subject.user_id,
        title=subject.title,
        description=subject.description,
        created_at=subject.created_at,
        topic_count=topic_count,
    )


@router.delete("/{subject_id}", status_code=204)
async def delete_subject(
    subject_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a subject. Topics under it become ungrouped (subject_id → NULL)."""
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    subject = result.scalar_one_or_none()
    if subject is None:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Ungroup topics (the FK has ondelete=SET NULL, but do it explicitly for clarity)
    topics_result = await db.execute(
        select(LearningTopic).where(LearningTopic.subject_id == subject_id)
    )
    for topic in topics_result.scalars():
        topic.subject_id = None

    await db.delete(subject)
    await db.commit()
