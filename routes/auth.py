"""
Authentication routes.

Handles login, logout, token verification, and password changes.
"""

import threading
import time

from fastapi.responses import JSONResponse
import auth
from db.users import update_password, get_user_by_id

LOGIN_MAX_ATTEMPTS = 5
LOGIN_WINDOW_SECONDS = 60
LOGIN_LOCKOUT_SECONDS = 300


class _LoginRateLimiter:
    """Username-based rate limiter for login attempts."""

    def __init__(self):
        self._attempts: dict[str, list[float]] = {}
        self._lockouts: dict[str, float] = {}
        self._lock = threading.Lock()

    def check(self, username: str) -> tuple[bool, int]:
        key = username.lower().strip()
        now = time.time()
        with self._lock:
            if key in self._lockouts:
                if now < self._lockouts[key]:
                    return False, int(self._lockouts[key] - now) + 1
                del self._lockouts[key]
                self._attempts.pop(key, None)

            cutoff = now - LOGIN_WINDOW_SECONDS
            recent = [t for t in self._attempts.get(key, []) if t > cutoff]
            self._attempts[key] = recent

            if len(recent) >= LOGIN_MAX_ATTEMPTS:
                self._lockouts[key] = now + LOGIN_LOCKOUT_SECONDS
                return False, LOGIN_LOCKOUT_SECONDS

            self._attempts[key].append(now)
            return True, 0

    def clear(self, username: str):
        key = username.lower().strip()
        with self._lock:
            self._attempts.pop(key, None)
            self._lockouts.pop(key, None)


_login_limiter = _LoginRateLimiter()


def register_auth_routes(mcp):
    """Register authentication routes."""

    @mcp.custom_route("/api/v1/auth/login", methods=["POST"])
    async def api_auth_login(request):
        """Authenticate user and return session token with user info."""
        data = await request.json()
        email = data.get("username", "")  # Accept "username" for backwards compat
        password = data.get("password", "")

        allowed, retry_after = _login_limiter.check(email)
        if not allowed:
            return JSONResponse(
                {"success": False, "error": {"message": "Too many login attempts. Try again later.", "code": "RATE_LIMITED"}},
                status_code=429,
                headers={"Retry-After": str(retry_after)},
            )

        result = auth.authenticate(email, password)
        if result:
            _login_limiter.clear(email)
            return JSONResponse({
                "success": True,
                "token": result["token"],
                "user": result["user"],
                "mustChangePassword": result["mustChangePassword"],
            })
        return JSONResponse(
            {"success": False, "error": {"message": "Invalid credentials", "code": "INVALID_CREDENTIALS"}},
            status_code=401
        )

    @mcp.custom_route("/api/v1/auth/logout", methods=["POST"])
    async def api_auth_logout(request):
        """Logout user (invalidate token server-side)."""
        token = auth.get_token_from_request(request)
        if token:
            auth.invalidate_session(token)
        return JSONResponse({"success": True})

    @mcp.custom_route("/api/v1/auth/verify", methods=["GET"])
    async def api_auth_verify(request):
        """Verify if current token is valid, return user info and a refreshed token."""
        if err := auth.require_auth(request):
            return err

        user = auth.get_current_user(request)
        if not user:
            return JSONResponse(
                {"success": False, "error": {"message": "Invalid token", "code": "UNAUTHORIZED"}},
                status_code=401
            )

        # Extend the existing session and reissue the JWT (rolling expiry)
        token = auth.get_token_from_request(request)
        refreshed_token = auth.refresh_session(token, user)

        return JSONResponse({
            "success": True,
            "valid": True,
            "user": user,
            "token": refreshed_token,
        })

    @mcp.custom_route("/api/v1/auth/dale-bootstrap", methods=["POST"])
    async def api_auth_dale_bootstrap(request):
        """Exchange a long-lived bootstrap token for a normal session JWT.

        Called by the Dale PWA on first load (or whenever the device's
        localStorage has been wiped). The home-screen icon's URL contains
        the bootstrap token; this endpoint validates it and mints a session.
        """
        try:
            data = await request.json()
        except Exception:
            data = {}
        bootstrap_token = data.get("token", "")

        user_id = auth.verify_dale_bootstrap_token(bootstrap_token)
        if not user_id:
            return JSONResponse(
                {"success": False, "error": {"message": "Invalid or expired link. Ask the admin for a new one.", "code": "INVALID_BOOTSTRAP"}},
                status_code=401,
            )

        user = get_user_by_id(user_id)
        if not user or not user.get("is_active", True):
            return JSONResponse(
                {"success": False, "error": {"message": "User no longer active", "code": "INACTIVE_USER"}},
                status_code=401,
            )

        session_token = auth.create_session(user)
        return JSONResponse({
            "success": True,
            "token": session_token,
            "user": {
                "id": user["id"],
                "email": user["email"],
                "firstName": user["first_name"],
                "lastName": user["last_name"],
                "initials": user["initials"],
                "position": user["position"],
                "isAdmin": user["is_admin"],
                "paralegalId": user.get("paralegal_id"),
                "visibleFeatures": user.get("visible_features"),
            },
        })

    @mcp.custom_route("/api/v1/auth/dale-bootstrap-token", methods=["POST"])
    async def api_auth_dale_bootstrap_token_create(request):
        """Mint a fresh Dale bootstrap URL for a given user (admin only).

        Body: {"user_id": int}
        Returns: {"token": str, "url": str}
        """
        if err := auth.require_admin(request):
            return err

        try:
            data = await request.json()
        except Exception:
            data = {}
        try:
            target_user_id = int(data.get("user_id", 0))
        except (TypeError, ValueError):
            target_user_id = 0
        if target_user_id <= 0:
            return JSONResponse(
                {"success": False, "error": {"message": "user_id is required", "code": "VALIDATION_ERROR"}},
                status_code=400,
            )

        target = get_user_by_id(target_user_id)
        if not target:
            return JSONResponse(
                {"success": False, "error": {"message": "User not found", "code": "NOT_FOUND"}},
                status_code=404,
            )

        token = auth.create_dale_bootstrap_token(target_user_id)
        # Build a relative path; the caller's frontend already knows its origin.
        return JSONResponse({
            "success": True,
            "token": token,
            "path": f"/dale/auth/{token}",
            "user": {
                "id": target["id"],
                "email": target["email"],
                "firstName": target["first_name"],
                "lastName": target["last_name"],
            },
        })

    @mcp.custom_route("/api/v1/auth/change-password", methods=["POST"])
    async def api_auth_change_password(request):
        """Change the current user's password."""
        if err := auth.require_auth(request):
            return err

        user = auth.get_current_user(request)
        if not user:
            return JSONResponse(
                {"success": False, "error": {"message": "Invalid token", "code": "UNAUTHORIZED"}},
                status_code=401
            )

        # Legacy env var users can't change password
        if user.get("id") == 0:
            return JSONResponse(
                {"success": False, "error": {"message": "Legacy users cannot change password", "code": "NOT_ALLOWED"}},
                status_code=400
            )

        data = await request.json()
        current_password = data.get("currentPassword", "")
        new_password = data.get("newPassword", "")

        if not new_password:
            return JSONResponse(
                {"success": False, "error": {"message": "New password is required", "code": "VALIDATION_ERROR"}},
                status_code=400
            )

        if len(new_password) < 8:
            return JSONResponse(
                {"success": False, "error": {"message": "Password must be at least 8 characters", "code": "VALIDATION_ERROR"}},
                status_code=400
            )

        # Verify current password (fetch from DB to get hash)
        from db.users import get_user_by_email, verify_password
        db_user = get_user_by_email(user["email"])
        if not db_user:
            return JSONResponse(
                {"success": False, "error": {"message": "User not found", "code": "NOT_FOUND"}},
                status_code=404
            )

        if not verify_password(current_password, db_user["password_hash"]):
            return JSONResponse(
                {"success": False, "error": {"message": "Current password is incorrect", "code": "INVALID_PASSWORD"}},
                status_code=400
            )

        # Invalidate all existing sessions, then update password
        from db.auth_sessions import delete_user_sessions
        delete_user_sessions(user["id"])
        success = update_password(user["id"], new_password, clear_must_change=True)
        if not success:
            return JSONResponse(
                {"success": False, "error": {"message": "Failed to update password", "code": "UPDATE_FAILED"}},
                status_code=500
            )

        # Generate new token with updated user info
        updated_user = get_user_by_id(user["id"])
        new_token = auth.create_session(updated_user)

        return JSONResponse({
            "success": True,
            "token": new_token,
            "user": {
                "id": updated_user["id"],
                "email": updated_user["email"],
                "firstName": updated_user["first_name"],
                "lastName": updated_user["last_name"],
                "initials": updated_user["initials"],
                "position": updated_user["position"],
                "isAdmin": updated_user["is_admin"],
                "paralegalId": updated_user.get("paralegal_id"),
            },
        })
