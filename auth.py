"""
Authentication module for basic username/password auth.

Uses JWT tokens for stateless authentication (works with multiple workers).
"""

import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi.responses import JSONResponse
import jwt


# Session expiry: 24 hours
SESSION_EXPIRY_HOURS = 24

# Environment variables with dev defaults
AUTH_USERNAME = os.getenv("AUTH_USERNAME", "a")
AUTH_PASSWORD = os.getenv("AUTH_PASSWORD", "a")

# JWT secret - uses AUTH_PASSWORD as secret, or generate one if not set
# In production, AUTH_PASSWORD should be a strong secret
JWT_SECRET = os.getenv("JWT_SECRET", AUTH_PASSWORD)
JWT_ALGORITHM = "HS256"


def authenticate(username: str, password: str) -> Optional[str]:
    """
    Validate credentials against env vars.
    Returns JWT token on success, None on failure.
    Uses timing-safe comparison to prevent timing attacks.
    """
    username_valid = secrets.compare_digest(username, AUTH_USERNAME)
    password_valid = secrets.compare_digest(password, AUTH_PASSWORD)

    if username_valid and password_valid:
        return create_session(username)
    return None


def create_session(username: str) -> str:
    """Create a JWT token for the user."""
    expiry = datetime.now(timezone.utc) + timedelta(hours=SESSION_EXPIRY_HOURS)
    payload = {
        "sub": username,
        "exp": expiry,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def validate_session(token: str) -> bool:
    """Check if a JWT token is valid and not expired."""
    try:
        jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return True
    except jwt.ExpiredSignatureError:
        return False
    except jwt.InvalidTokenError:
        return False


def invalidate_session(token: str) -> bool:
    """
    JWT tokens are stateless and can't be invalidated server-side.
    Returns True for API compatibility. Client should discard the token.
    """
    return True


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
