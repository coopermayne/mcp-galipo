"""
Unified contact search endpoint — persons and judges together.
"""

import asyncio

from fastapi.responses import JSONResponse

import auth
from db.contacts import unified_contact_search
from .common import api_error


def register_contact_routes(mcp):
    """Register unified contact search routes."""

    @mcp.custom_route("/api/v1/contacts/search", methods=["GET"])
    async def api_search_contacts(request):
        """Unified search across persons and judges."""
        if err := auth.require_auth(request):
            return err

        q = request.query_params.get("q", "").strip()
        if len(q) < 2:
            return JSONResponse({"results": [], "total": 0})

        limit = int(request.query_params.get("limit", "25"))
        result = await asyncio.to_thread(unified_contact_search, q, limit)
        return JSONResponse(result)
