"""
User management routes (admin-only).

Provides REST endpoints for managing users in the system.
"""

from fastapi.responses import JSONResponse
import auth
from db.users import (
    get_all_users,
    get_user_by_id,
    get_user_by_email,
    create_user,
    update_user,
    delete_user,
    update_password,
)
from db.validation import ValidationError


# Valid positions for users
VALID_POSITIONS = ['attorney', 'paralegal', 'manager', 'admin']

# Default password for new users
DEFAULT_PASSWORD = 'changeme'


def _user_to_camel(user: dict) -> dict:
    """Convert user dict from snake_case to camelCase for frontend."""
    if not user:
        return None
    return {
        "id": user["id"],
        "email": user["email"],
        "firstName": user.get("first_name"),
        "lastName": user.get("last_name"),
        "initials": user.get("initials"),
        "barNumber": user.get("bar_number"),
        "position": user.get("position"),
        "isAdmin": user.get("is_admin", False),
        "mustChangePassword": user.get("must_change_password", False),
        "isActive": user.get("is_active", True),
        "createdAt": user.get("created_at"),
        "updatedAt": user.get("updated_at"),
    }


def register_user_routes(mcp):
    """Register user management routes (admin-only)."""

    @mcp.custom_route("/api/v1/users", methods=["GET"])
    async def api_get_users(request):
        """Get all users (admin-only)."""
        if err := auth.require_admin(request):
            return err

        include_inactive = request.query_params.get("include_inactive", "false").lower() == "true"
        users = get_all_users(include_inactive=include_inactive)
        return JSONResponse({"success": True, "data": [_user_to_camel(u) for u in users]})

    @mcp.custom_route("/api/v1/users", methods=["POST"])
    async def api_create_user(request):
        """Create a new user (admin-only)."""
        if err := auth.require_admin(request):
            return err

        data = await request.json()

        # Validate required fields
        required = ["email", "firstName", "lastName", "initials", "position"]
        missing = [f for f in required if not data.get(f)]
        if missing:
            return JSONResponse(
                {"success": False, "error": {"message": f"Missing required fields: {', '.join(missing)}", "code": "VALIDATION_ERROR"}},
                status_code=400
            )

        # Validate position
        position = data.get("position", "").lower()
        if position not in VALID_POSITIONS:
            return JSONResponse(
                {"success": False, "error": {"message": f"Invalid position. Must be one of: {', '.join(VALID_POSITIONS)}", "code": "VALIDATION_ERROR"}},
                status_code=400
            )

        # Check for existing email
        existing = get_user_by_email(data["email"])
        if existing:
            return JSONResponse(
                {"success": False, "error": {"message": "A user with this email already exists", "code": "DUPLICATE_EMAIL"}},
                status_code=409
            )

        try:
            user = create_user(
                email=data["email"],
                password=data.get("password", DEFAULT_PASSWORD),
                first_name=data["firstName"],
                last_name=data["lastName"],
                initials=data["initials"],
                position=position,
                bar_number=data.get("barNumber"),
                is_admin=data.get("isAdmin", False),
                must_change_password=data.get("mustChangePassword", True),
            )
            return JSONResponse({"success": True, "data": _user_to_camel(user)}, status_code=201)
        except Exception as e:
            return JSONResponse(
                {"success": False, "error": {"message": str(e), "code": "CREATE_FAILED"}},
                status_code=500
            )

    @mcp.custom_route("/api/v1/users/{user_id}", methods=["GET"])
    async def api_get_user(request):
        """Get a single user by ID (admin-only)."""
        if err := auth.require_admin(request):
            return err

        user_id = int(request.path_params["user_id"])
        user = get_user_by_id(user_id)

        if not user:
            return JSONResponse(
                {"success": False, "error": {"message": "User not found", "code": "NOT_FOUND"}},
                status_code=404
            )

        return JSONResponse({"success": True, "data": _user_to_camel(user)})

    @mcp.custom_route("/api/v1/users/{user_id}", methods=["PUT"])
    async def api_update_user(request):
        """Update a user (admin-only)."""
        if err := auth.require_admin(request):
            return err

        user_id = int(request.path_params["user_id"])
        data = await request.json()

        # Check user exists
        existing = get_user_by_id(user_id)
        if not existing:
            return JSONResponse(
                {"success": False, "error": {"message": "User not found", "code": "NOT_FOUND"}},
                status_code=404
            )

        # Validate position if provided
        if "position" in data:
            position = data["position"].lower()
            if position not in VALID_POSITIONS:
                return JSONResponse(
                    {"success": False, "error": {"message": f"Invalid position. Must be one of: {', '.join(VALID_POSITIONS)}", "code": "VALIDATION_ERROR"}},
                    status_code=400
                )
            data["position"] = position

        # Check for email uniqueness if changing email
        if "email" in data and data["email"].lower() != existing["email"].lower():
            email_check = get_user_by_email(data["email"])
            if email_check:
                return JSONResponse(
                    {"success": False, "error": {"message": "A user with this email already exists", "code": "DUPLICATE_EMAIL"}},
                    status_code=409
                )

        try:
            # Map camelCase to snake_case
            update_data = {}
            if "email" in data:
                update_data["email"] = data["email"]
            if "firstName" in data:
                update_data["first_name"] = data["firstName"]
            if "lastName" in data:
                update_data["last_name"] = data["lastName"]
            if "initials" in data:
                update_data["initials"] = data["initials"]
            if "position" in data:
                update_data["position"] = data["position"]
            if "barNumber" in data:
                update_data["bar_number"] = data["barNumber"]
            if "isAdmin" in data:
                update_data["is_admin"] = data["isAdmin"]
            if "mustChangePassword" in data:
                update_data["must_change_password"] = data["mustChangePassword"]
            if "isActive" in data:
                update_data["is_active"] = data["isActive"]

            user = update_user(user_id, **update_data)
            return JSONResponse({"success": True, "data": _user_to_camel(user)})
        except Exception as e:
            return JSONResponse(
                {"success": False, "error": {"message": str(e), "code": "UPDATE_FAILED"}},
                status_code=500
            )

    @mcp.custom_route("/api/v1/users/{user_id}", methods=["DELETE"])
    async def api_delete_user(request):
        """Deactivate a user (soft delete, admin-only)."""
        if err := auth.require_admin(request):
            return err

        user_id = int(request.path_params["user_id"])

        # Check user exists
        existing = get_user_by_id(user_id)
        if not existing:
            return JSONResponse(
                {"success": False, "error": {"message": "User not found", "code": "NOT_FOUND"}},
                status_code=404
            )

        # Prevent deleting yourself
        current_user = auth.get_current_user(request)
        if current_user and current_user.get("id") == user_id:
            return JSONResponse(
                {"success": False, "error": {"message": "Cannot deactivate your own account", "code": "SELF_DELETE"}},
                status_code=400
            )

        # Check if this is from query param for hard delete
        hard_delete = request.query_params.get("hard", "false").lower() == "true"

        success = delete_user(user_id, hard_delete=hard_delete)
        if success:
            return JSONResponse({"success": True})
        return JSONResponse(
            {"success": False, "error": {"message": "Failed to delete user", "code": "DELETE_FAILED"}},
            status_code=500
        )

    @mcp.custom_route("/api/v1/users/{user_id}/reset-password", methods=["POST"])
    async def api_reset_user_password(request):
        """Reset a user's password to default (admin-only)."""
        if err := auth.require_admin(request):
            return err

        user_id = int(request.path_params["user_id"])

        # Check user exists
        existing = get_user_by_id(user_id)
        if not existing:
            return JSONResponse(
                {"success": False, "error": {"message": "User not found", "code": "NOT_FOUND"}},
                status_code=404
            )

        # Reset password and set must_change_password
        success = update_password(user_id, DEFAULT_PASSWORD, clear_must_change=False)
        if success:
            # Also set must_change_password flag
            update_user(user_id, must_change_password=True)
            return JSONResponse({"success": True, "defaultPassword": DEFAULT_PASSWORD})

        return JSONResponse(
            {"success": False, "error": {"message": "Failed to reset password", "code": "RESET_FAILED"}},
            status_code=500
        )
