"""Centralised configuration — reads .env once at import time."""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the project root (one level above backend/)
_env_path = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(_env_path)


class Settings:
    """Plain settings object — no magic, just env vars with defaults."""

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://srl_user:password@localhost:5432/srl_tool",
    )

    # Firebase
    FIREBASE_PROJECT_ID: str = os.getenv("FIREBASE_PROJECT_ID", "")
    FIREBASE_SERVICE_ACCOUNT: str = os.getenv(
        "FIREBASE_SERVICE_ACCOUNT", "./firebase-service-account.json"
    )

    # OpenRouter / LLM
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")

    # Serper Search
    SERPER_API_KEY: str = os.getenv("SERPER_API_KEY", "")


settings = Settings()
