"""Firebase Admin SDK initialisation and token verification."""

import logging
from pathlib import Path

import firebase_admin
from firebase_admin import auth, credentials

from .config import settings

_log = logging.getLogger(__name__)

# Resolve service-account path relative to project root
_sa_path = Path(__file__).resolve().parents[2] / settings.FIREBASE_SERVICE_ACCOUNT

if not firebase_admin._apps:
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
