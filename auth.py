"""
Authentication module for multi-user JWT auth.

Uses database-backed users with bcrypt password hashing.
Falls back to env vars during transition period.
"""

import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi.responses import JSONResponse
import jwt

from db.users import authenticate_user, get_user_by_id


# Session expiry: 24 hours
SESSION_EXPIRY_HOURS = 24

# Legacy environment variables (fallback during transition)
AUTH_USERNAME = os.getenv("AUTH_USERNAME")
AUTH_PASSWORD = os.getenv("AUTH_PASSWORD")

# JWT secret - uses env var or generates one
JWT_SECRET = os.getenv("JWT_SECRET", os.getenv("AUTH_PASSWORD", secrets.token_hex(32)))
JWT_ALGORITHM = "HS256"


def authenticate(email: str, password: str) -> Optional[dict]:
    """
    Validate credentials against database.
    Returns dict with token and user info on success, None on failure.

    Falls back to env var auth if database user not found (transition period).
    """
    # Try database authentication first
    user = authenticate_user(email, password)
    if user:
        token = create_session(user)
        return {
            "token": token,
            "user": {
                "id": user["id"],
                "email": user["email"],
                "firstName": user["first_name"],
                "lastName": user["last_name"],
                "initials": user["initials"],
                "position": user["position"],
                "isAdmin": user["is_admin"],
                "paralegalId": user.get("paralegal_id"),
            },
            "mustChangePassword": user["must_change_password"],
        }

    # Fallback to env var auth (for transition period)
    if AUTH_USERNAME and AUTH_PASSWORD:
        username_valid = secrets.compare_digest(email, AUTH_USERNAME)
        password_valid = secrets.compare_digest(password, AUTH_PASSWORD)
        if username_valid and password_valid:
            token = create_legacy_session(email)
            return {
                "token": token,
                "user": {
                    "id": 0,
                    "email": email,
                    "firstName": "Admin",
                    "lastName": "User",
                    "initials": "AU",
                    "position": "admin",
                    "isAdmin": True,
                },
                "mustChangePassword": False,
            }

    return None


def create_session(user: dict) -> str:
    """Create a JWT token for a database user."""
    expiry = datetime.now(timezone.utc) + timedelta(hours=SESSION_EXPIRY_HOURS)
    payload = {
        "sub": str(user["id"]),
        "email": user["email"],
        "is_admin": user["is_admin"],
        "exp": expiry,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_legacy_session(username: str) -> str:
    """Create a JWT token for legacy env var auth (transition period)."""
    expiry = datetime.now(timezone.utc) + timedelta(hours=SESSION_EXPIRY_HOURS)
    payload = {
        "sub": "0",  # Legacy user ID
        "email": username,
        "is_admin": True,
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


def get_session_user(token: str) -> Optional[dict]:
    """
    Get user info from a valid JWT token.
    Returns user dict if valid, None if invalid.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = int(payload.get("sub", 0))

        # Legacy env var user
        if user_id == 0:
            return {
                "id": 0,
                "email": payload.get("email", ""),
                "firstName": "Admin",
                "lastName": "User",
                "initials": "AU",
                "position": "admin",
                "isAdmin": True,
            }

        # Database user - fetch fresh data
        user = get_user_by_id(user_id)
        if not user or not user.get("is_active", True):
            return None

        return {
            "id": user["id"],
            "email": user["email"],
            "firstName": user["first_name"],
            "lastName": user["last_name"],
            "initials": user["initials"],
            "position": user["position"],
            "isAdmin": user["is_admin"],
            "paralegalId": user.get("paralegal_id"),
        }
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


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


def require_admin(request) -> Optional[JSONResponse]:
    """
    Check if request is authenticated AND user is admin.
    Returns None if authorized, or a 401/403 JSONResponse if not.
    """
    # First check basic auth
    auth_error = require_auth(request)
    if auth_error:
        return auth_error

    # Then check admin status
    token = get_token_from_request(request)
    user = get_session_user(token)

    if not user or not user.get("isAdmin"):
        return JSONResponse(
            {"success": False, "error": {"message": "Admin access required", "code": "FORBIDDEN"}},
            status_code=403
        )

    return None


def get_current_user(request) -> Optional[dict]:
    """Get the current authenticated user from request."""
    token = get_token_from_request(request)
    if not token:
        return None
    return get_session_user(token)
