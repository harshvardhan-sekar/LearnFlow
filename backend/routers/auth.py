"""Authentication router — register, login (verify token), and me."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from models.user import User
from utils.dependencies import get_current_user
from utils.firebase import verify_firebase_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── Schemas ──────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    firebase_uid: str
    email: str
    display_name: str | None = None
    role: str = "participant"


class UserResponse(BaseModel):
    id: int
    firebase_uid: str
    email: str
    display_name: str | None
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Routes ───────────────────────────────────────────────────────────────

@router.post("/register", response_model=UserResponse, status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Create a user row in PostgreSQL after the frontend has already
    created the Firebase account.
    """
    # Check for duplicate firebase_uid or email
    existing = await db.execute(
        select(User).where(
            (User.firebase_uid == body.firebase_uid) | (User.email == body.email)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this firebase_uid or email already exists.",
        )

    user = User(
        firebase_uid=body.firebase_uid,
        email=body.email,
        display_name=body.display_name,
        role=body.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=UserResponse)
async def login(
    current_user: User = Depends(get_current_user),
):
    """Validate the Firebase ID token (via dependency) and return the
    matching DB profile.
    """
    return current_user


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    """Return the authenticated user's profile."""
    return current_user
