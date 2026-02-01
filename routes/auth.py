"""
Authentication routes.

Handles login, logout, token verification, and password changes.
"""

from fastapi.responses import JSONResponse
import auth
from db.users import update_password, get_user_by_id


def register_auth_routes(mcp):
    """Register authentication routes."""

    @mcp.custom_route("/api/v1/auth/login", methods=["POST"])
    async def api_auth_login(request):
        """Authenticate user and return session token with user info."""
        data = await request.json()
        email = data.get("username", "")  # Accept "username" for backwards compat
        password = data.get("password", "")

        result = auth.authenticate(email, password)
        if result:
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
        """Logout user (invalidate token)."""
        # Token invalidation would be handled here if we had a session store
        return JSONResponse({"success": True})

    @mcp.custom_route("/api/v1/auth/verify", methods=["GET"])
    async def api_auth_verify(request):
        """Verify if current token is valid and return user info."""
        if err := auth.require_auth(request):
            return err

        user = auth.get_current_user(request)
        if not user:
            return JSONResponse(
                {"success": False, "error": {"message": "Invalid token", "code": "UNAUTHORIZED"}},
                status_code=401
            )

        return JSONResponse({
            "success": True,
            "valid": True,
            "user": user,
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

        # Update password
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
            },
        })
