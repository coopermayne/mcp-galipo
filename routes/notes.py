"""
Note routes.

Handles note CRUD operations for cases.
"""

import asyncio
from fastapi.responses import JSONResponse
import database as db
import auth
from .common import api_error


def register_note_routes(mcp):
    """Register note management routes."""

    @mcp.custom_route("/api/v1/notes", methods=["POST"])
    async def api_create_note(request):
        """Create a new note."""
        if err := auth.require_auth(request):
            return err
        data = await request.json()
        result = await asyncio.to_thread(db.add_note, data["case_id"], data["content"])
        return JSONResponse({"success": True, "note": result})

    @mcp.custom_route("/api/v1/notes/{note_id}", methods=["DELETE"])
    async def api_delete_note(request):
        """Delete a note."""
        if err := auth.require_auth(request):
            return err
        note_id = int(request.path_params["note_id"])
        deleted = await asyncio.to_thread(db.delete_note, note_id)
        if deleted:
            return JSONResponse({"success": True})
        return api_error("Note not found", "NOT_FOUND", 404)
