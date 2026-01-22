"""
Authentication routes.

Handles login, logout, and token verification.
"""

from fastapi.responses import JSONResponse
import auth


def register_auth_routes(mcp):
    """Register authentication routes."""

    @mcp.custom_route("/api/v1/auth/login", methods=["POST"])
    async def api_auth_login(request):
        """Authenticate user and return session token."""
        data = await request.json()
        username = data.get("username", "")
        password = data.get("password", "")
        token = auth.authenticate(username, password)
        if token:
            return JSONResponse({"success": True, "token": token})
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
        """Verify if current token is valid."""
        if err := auth.require_auth(request):
            return err
        return JSONResponse({"success": True, "valid": True})
