"""
Authentication module for basic username/password auth.

Session tokens stored in-memory with 24hr expiry.
"""

import os
import secrets
import time
from typing import Optional
from fastapi.responses import JSONResponse


# In-memory session storage: token -> (username, expiry_timestamp)
_sessions: dict[str, tuple[str, float]] = {}

# Session expiry: 24 hours in seconds
SESSION_EXPIRY = 24 * 60 * 60

# Environment variables with dev defaults
AUTH_USERNAME = os.getenv("AUTH_USERNAME", "admin")
AUTH_PASSWORD = os.getenv("AUTH_PASSWORD", "asdf")


def authenticate(username: str, password: str) -> Optional[str]:
    """
    Validate credentials against env vars.
    Returns session token on success, None on failure.
    Uses timing-safe comparison to prevent timing attacks.
    """
    username_valid = secrets.compare_digest(username, AUTH_USERNAME)
    password_valid = secrets.compare_digest(password, AUTH_PASSWORD)

    if username_valid and password_valid:
        return create_session(username)
    return None


def create_session(username: str) -> str:
    """Create a new session and return the token."""
    token = secrets.token_urlsafe(32)
    expiry = time.time() + SESSION_EXPIRY
    _sessions[token] = (username, expiry)
    return token


def validate_session(token: str) -> bool:
    """Check if a token is valid and not expired."""
    if token not in _sessions:
        return False

    username, expiry = _sessions[token]
    if time.time() > expiry:
        # Clean up expired session
        del _sessions[token]
        return False

    return True


def invalidate_session(token: str) -> bool:
    """Remove a session token. Returns True if it existed."""
    if token in _sessions:
        del _sessions[token]
        return True
    return False


def get_token_from_request(request) -> Optional[str]:
    """Extract Bearer token from Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


def require_auth(request) -> Optional[JSONResponse]:
    """
    Check if request is authenticated.
    Returns None if authenticated, or a 401 JSONResponse if not.
    """
    token = get_token_from_request(request)

    if not token:
        return JSONResponse(
            {"success": False, "error": {"message": "Authentication required", "code": "UNAUTHORIZED"}},
            status_code=401
        )

    if not validate_session(token):
        return JSONResponse(
            {"success": False, "error": {"message": "Invalid or expired token", "code": "UNAUTHORIZED"}},
            status_code=401
        )

    return None
