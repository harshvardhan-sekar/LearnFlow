"""Firebase Admin SDK initialisation and token verification."""

import json
import logging
from pathlib import Path

import firebase_admin
from firebase_admin import auth, credentials

from .config import settings

_log = logging.getLogger(__name__)

_sa_value = settings.FIREBASE_SERVICE_ACCOUNT

if not firebase_admin._apps:
    # Accept either a raw JSON string (Railway env var) or a file path (local dev)
    if _sa_value.strip().startswith("{"):
        try:
            sa_dict = json.loads(_sa_value)
            cred = credentials.Certificate(sa_dict)
            firebase_admin.initialize_app(cred, {"projectId": settings.FIREBASE_PROJECT_ID})
            _log.info("Firebase initialised from inline JSON credentials.")
        except Exception as exc:
            _log.warning(
                "Failed to initialise Firebase from inline JSON: %s — "
                "token verification will fail.",
                exc,
            )
    else:
        # Resolve file path: absolute used as-is, relative resolved from project root
        if Path(_sa_value).is_absolute():
            _sa_path = Path(_sa_value)
        else:
            _sa_path = Path(__file__).resolve().parents[2] / _sa_value

        if _sa_path.exists():
            cred = credentials.Certificate(str(_sa_path))
            firebase_admin.initialize_app(cred, {"projectId": settings.FIREBASE_PROJECT_ID})
        else:
            _log.warning(
                "Firebase service-account file not found at %s — "
                "token verification will fail until the file is provided.",
                _sa_path,
            )


def verify_firebase_token(id_token: str) -> dict:
    """Verify a Firebase ID token and return the decoded claims.

    Returns a dict with at least ``uid``, ``email``, and other standard
    Firebase claims.

    Raises ``firebase_admin.auth.InvalidIdTokenError`` on bad / expired tokens.
    Raises ``ValueError`` if the Firebase app was never initialised.
    """
    if not firebase_admin._apps:
        raise ValueError(
            "Firebase Admin SDK not initialised — "
            "place the service-account JSON at the path in FIREBASE_SERVICE_ACCOUNT."
        )
    decoded = auth.verify_id_token(id_token)
    return decoded
