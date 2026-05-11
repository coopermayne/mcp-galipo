"""
Authentication module for multi-user JWT auth.

Uses database-backed users with bcrypt password hashing.
Falls back to env vars during transition period.
"""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi.responses import JSONResponse
import jwt

from config import settings
from db.users import authenticate_user, get_user_by_id
from db.activity import touch_last_active
from db.auth_sessions import (
    create_auth_session,
    validate_auth_session,
    extend_auth_session,
    delete_auth_session,
    delete_user_sessions,
)


SESSION_EXPIRY_HOURS = 24

# Legacy environment variables (fallback during transition)
AUTH_USERNAME = settings.auth_username
AUTH_PASSWORD = settings.auth_password

# JWT secret
JWT_SECRET = settings.jwt_secret
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
                "barNumber": user.get("bar_number"),
                "position": user["position"],
                "isAdmin": user["is_admin"],
                "paralegalId": user.get("paralegal_id"),
                "visibleFeatures": user.get("visible_features"),
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
    """Create a JWT token for a database user with a server-side session."""
    user_id = user["id"]
    sid = create_auth_session(user_id, SESSION_EXPIRY_HOURS)
    expiry = datetime.now(timezone.utc) + timedelta(hours=SESSION_EXPIRY_HOURS)
    payload = {
        "sub": str(user_id),
        "sid": sid,
        "email": user["email"],
        "is_admin": user["is_admin"],
        "exp": expiry,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_legacy_session(username: str) -> str:
    """Create a JWT token for legacy env var auth (transition period)."""
    sid = create_auth_session(0, SESSION_EXPIRY_HOURS)
    expiry = datetime.now(timezone.utc) + timedelta(hours=SESSION_EXPIRY_HOURS)
    payload = {
        "sub": "0",
        "sid": sid,
        "email": username,
        "is_admin": True,
        "exp": expiry,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def validate_session(token: str) -> bool:
    """Check if a JWT token is valid, not expired, and not revoked."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        sid = payload.get("sid")
        if not sid:
            return False
        return validate_auth_session(sid)
    except jwt.ExpiredSignatureError:
        return False
    except jwt.InvalidTokenError:
        return False


def refresh_session(token: str, user: dict) -> str:
    """Extend the existing session and return a new JWT with the same sid."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        sid = payload.get("sid")
        if sid:
            extend_auth_session(sid, SESSION_EXPIRY_HOURS)
            expiry = datetime.now(timezone.utc) + timedelta(hours=SESSION_EXPIRY_HOURS)
            new_payload = {
                "sub": payload["sub"],
                "sid": sid,
                "email": user.get("email", payload.get("email", "")),
                "is_admin": user.get("isAdmin", user.get("is_admin", payload.get("is_admin", False))),
                "exp": expiry,
                "iat": datetime.now(timezone.utc),
            }
            return jwt.encode(new_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    except jwt.InvalidTokenError:
        pass
    # Fallback: create a new session if the old one can't be refreshed
    if user.get("id", 0) == 0:
        return create_legacy_session(user.get("email", ""))
    return create_session({
        "id": user["id"],
        "email": user.get("email", ""),
        "is_admin": user.get("isAdmin", user.get("is_admin", False)),
    })


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
            "visibleFeatures": user.get("visible_features"),
        }
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def invalidate_session(token: str) -> bool:
    """Revoke a session server-side so the token can no longer be used."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM], options={"verify_exp": False})
        sid = payload.get("sid")
        if sid:
            delete_auth_session(sid)
        return True
    except jwt.InvalidTokenError:
        return False


SIGNED_URL_EXPIRY_SECONDS = 60


def create_file_token(path: str) -> str:
    """Create a short-lived JWT scoped to a specific file path."""
    expiry = datetime.now(timezone.utc) + timedelta(seconds=SIGNED_URL_EXPIRY_SECONDS)
    payload = {
        "purpose": "file",
        "path": path,
        "exp": expiry,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def validate_file_token(token: str, expected_path: str) -> bool:
    """Validate a short-lived file token matches the requested path."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("purpose") == "file" and payload.get("path") == expected_path
    except jwt.InvalidTokenError:
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
    Also updates the user's last_active_at timestamp (throttled to once/min).
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

    # Update last_active_at (throttled inside touch_last_active)
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = int(payload.get("sub", 0))
        if user_id > 0:
            touch_last_active(user_id)
    except Exception:
        pass  # Don't let tracking failures break auth

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
