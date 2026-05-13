"""Trial calendar API endpoint."""

import asyncio
from fastapi.responses import JSONResponse, Response

import auth
from db.trial_calendar import get_trial_calendar
from db.users import get_all_users
from services.trial_calendar_pdf import generate_trial_calendar_pdf


def register_trial_calendar_routes(mcp):
    @mcp.custom_route("/api/v1/trial-calendar", methods=["GET"])
    async def api_get_trial_calendar(request):
        """Get trial calendar data: trials + blocking events."""
        if err := auth.require_auth(request):
            return err

        months_ahead = int(request.query_params.get("months_ahead", "6"))
        months_behind = int(request.query_params.get("months_behind", "1"))

        result = await asyncio.to_thread(get_trial_calendar, months_ahead, months_behind)
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/trial-calendar/pdf", methods=["GET"])
    async def api_trial_calendar_pdf(request):
        """Export trial calendar as landscape PDF."""
        if err := auth.require_auth(request):
            return err

        months_ahead = int(request.query_params.get("months_ahead", "12"))
        months_behind = int(request.query_params.get("months_behind", "0"))

        def _generate():
            data = get_trial_calendar(months_ahead, months_behind)
            users = get_all_users(include_inactive=False)
            staff_map = {
                u["id"]: u for u in users
                if u.get("position") in ("attorney", "paralegal")
            }
            return generate_trial_calendar_pdf(data["trials"], staff_map)

        buf = await asyncio.to_thread(_generate)
        return Response(
            content=buf.read(),
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="trial-calendar.pdf"'},
        )
