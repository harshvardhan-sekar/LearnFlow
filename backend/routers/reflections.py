"""Reflections router — post-session self-reflection capture."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from models.reflection import Reflection
from models.session import Session
from models.user import User
from utils.dependencies import get_current_user

router = APIRouter(prefix="/api/reflections", tags=["reflections"])


# ── Schemas ──────────────────────────────────────────────────────────────


class ReflectionCreate(BaseModel):
    session_id: int
    reflection_text: str
    confidence_rating: int = Field(ge=1, le=5)
    difficulty_rating: int = Field(ge=1, le=5)


class ReflectionResponse(BaseModel):
    id: int
    session_id: int
    user_id: int | None
    reflection_text: str | None
    confidence_rating: int | None
    difficulty_rating: int | None
    created_at: datetime

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


# ── Routes ───────────────────────────────────────────────────────────────


@router.post("", response_model=ReflectionResponse, status_code=201)
async def create_reflection(
    body: ReflectionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit a post-session reflection."""
    await _get_own_session_or_404(body.session_id, user, db)

    reflection = Reflection(
        session_id=body.session_id,
        user_id=user.id,
        reflection_text=body.reflection_text,
        confidence_rating=body.confidence_rating,
        difficulty_rating=body.difficulty_rating,
    )
    db.add(reflection)
    await db.commit()
    await db.refresh(reflection)
    return reflection


@router.get("/{session_id}", response_model=list[ReflectionResponse])
async def get_reflections(
    session_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all reflections for a session."""
    await _get_own_session_or_404(session_id, user, db)
    result = await db.execute(
        select(Reflection)
        .where(Reflection.session_id == session_id, Reflection.user_id == user.id)
        .order_by(Reflection.created_at)
    )
    return result.scalars().all()
