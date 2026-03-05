"""Centralised configuration — reads .env once at import time."""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the project root (one level above backend/)
_env_path = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(_env_path)


def _normalise_db_url(url: str) -> str:
    """Rewrite postgres(ql):// → postgresql+asyncpg:// for asyncpg compatibility.

    Railway and most cloud providers provision DATABASE_URL without the driver
    suffix, so we normalise it here before it reaches SQLAlchemy or Alembic.
    """
    if url.startswith("postgres://"):
        return "postgresql+asyncpg://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        return "postgresql+asyncpg://" + url[len("postgresql://"):]
    return url


class Settings:
    """Plain settings object — no magic, just env vars with defaults."""

    # Database
    DATABASE_URL: str = _normalise_db_url(
        os.getenv(
            "DATABASE_URL",
            "postgresql+asyncpg://srl_user:password@localhost:5432/srl_tool",
        )
    )

    # Firebase
    FIREBASE_PROJECT_ID: str = os.getenv("FIREBASE_PROJECT_ID", "")
    # Accepts either a file path (local dev) or a raw JSON string (Railway / CI)
    FIREBASE_SERVICE_ACCOUNT: str = os.getenv(
        "FIREBASE_SERVICE_ACCOUNT", "./firebase-service-account.json"
    )

    # OpenRouter / LLM
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")

    # Serper Search
    SERPER_API_KEY: str = os.getenv("SERPER_API_KEY", "")

    # CORS — comma-separated list of extra allowed origins (e.g. production frontend URL)
    ALLOWED_ORIGINS: str = os.getenv("ALLOWED_ORIGINS", "")


settings = Settings()
