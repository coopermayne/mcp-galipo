"""
Case health alert routes.

Computes data-quality / consistency issues across cases and exposes
dismiss / un-dismiss endpoints.
"""

import asyncio
from fastapi.responses import JSONResponse

import db
import auth
from .common import api_error
from .comments import _get_db_user_id


def register_alert_routes(mcp):
    """Register case-health alert routes."""

    @mcp.custom_route("/api/v1/alerts", methods=["GET"])
    async def api_list_alerts(request):
        """List current case-health alerts. Optional ?case_id= and ?include_dismissed=."""
        if err := auth.require_auth(request):
            return err
        case_id_param = request.query_params.get("case_id")
        case_id = int(case_id_param) if case_id_param else None
        include_dismissed = request.query_params.get("include_dismissed", "false").lower() == "true"

        result = await asyncio.to_thread(db.get_case_alerts, case_id, include_dismissed)
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/alerts/dismiss", methods=["POST"])
    async def api_dismiss_alert(request):
        """Dismiss a dismissible alert. Body: {case_id, rule_id, fingerprint?, reason?}."""
        if err := auth.require_auth(request):
            return err
        body = await request.json()
        case_id = body.get("case_id")
        rule_id = body.get("rule_id")
        if not case_id or not rule_id:
            return api_error("case_id and rule_id are required", "MISSING_FIELDS")

        user = auth.get_current_user(request)
        user_id = _get_db_user_id(user)
        try:
            result = await asyncio.to_thread(
                db.dismiss_alert, int(case_id), rule_id,
                body.get("fingerprint"), user_id, body.get("reason"),
            )
        except ValueError as e:
            return api_error(str(e), "INVALID_RULE")
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/alerts/dismiss", methods=["DELETE"])
    async def api_undismiss_alert(request):
        """Un-dismiss an alert. Query params: case_id, rule_id."""
        if err := auth.require_auth(request):
            return err
        case_id = request.query_params.get("case_id")
        rule_id = request.query_params.get("rule_id")
        if not case_id or not rule_id:
            return api_error("case_id and rule_id are required", "MISSING_FIELDS")

        result = await asyncio.to_thread(db.undismiss_alert, int(case_id), rule_id)
        return JSONResponse(result)
