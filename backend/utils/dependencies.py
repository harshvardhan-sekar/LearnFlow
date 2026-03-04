"""FastAPI dependencies shared across routers."""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from models.user import User

from .firebase import verify_firebase_token

_bearer = HTTPBearer()


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract Firebase ID token from the Authorization header, verify it,
    and return the matching PostgreSQL user row.
    """
    try:
        decoded = verify_firebase_token(creds.credentials)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Firebase token",
        )

    uid: str = decoded.get("uid", "")
    result = await db.execute(select(User).where(User.firebase_uid == uid))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found in database. Register first via POST /api/auth/register.",
        )

    return user


async def require_researcher(
    user: User = Depends(get_current_user),
) -> User:
    """Restrict access to users with role 'researcher' or 'admin'."""
    if user.role not in ("researcher", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Researcher access required",
        )
    return user
