"""Trial calendar API endpoint."""

import asyncio
from fastapi.responses import JSONResponse

import auth
from db.trial_calendar import get_trial_calendar


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
