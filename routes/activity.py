"""
Activity tracking routes.

- POST /api/v1/tracking/pageview — record a page view (any authenticated user)
- GET /api/v1/activity/summary — activity dashboard data (admin only)
- GET /api/v1/activity/user/:id — page views for a specific user (admin only)
"""

from fastapi import Request
from fastapi.responses import JSONResponse

import auth
from db.activity import record_page_view, get_activity_summary, get_user_page_views


def register_activity_routes(mcp):

    @mcp.custom_route("/api/v1/tracking/pageview", methods=["POST"])
    async def track_pageview(request: Request):
        if err := auth.require_auth(request):
            return err

        user = auth.get_current_user(request)
        if not user or user["id"] == 0:
            return JSONResponse({"success": True})  # skip legacy users

        body = await request.json()
        path = body.get("path", "").strip()
        if not path:
            return JSONResponse(
                {"success": False, "error": {"message": "path is required", "code": "VALIDATION_ERROR"}},
                status_code=400,
            )

        record_page_view(user["id"], path)
        return JSONResponse({"success": True})

    @mcp.custom_route("/api/v1/activity/summary", methods=["GET"])
    async def activity_summary(request: Request):
        if err := auth.require_admin(request):
            return err

        data = get_activity_summary()
        return JSONResponse({"success": True, "data": data})

    @mcp.custom_route("/api/v1/activity/user/{user_id}", methods=["GET"])
    async def user_page_views(request: Request):
        if err := auth.require_admin(request):
            return err

        user_id = int(request.path_params["user_id"])
        views = get_user_page_views(user_id)
        return JSONResponse({"success": True, "data": views})
