"""
Note MCP Tools

Tools for managing notes in the legal case management system.
"""

from typing import Optional
from mcp.server.fastmcp import Context
import database as db
from tools.utils import validation_error, not_found_error, check_empty_required_field


def register_note_tools(mcp):
    """Register note-related MCP tools."""

    @mcp.tool()
    def get_notes(context: Context, case_id: Optional[int] = None) -> dict:
        """Get notes, optionally filtered by case."""
        context.info(f"Fetching notes{' for case ' + str(case_id) if case_id else ''}")
        result = db.get_notes(case_id)
        context.info(f"Found {result['total']} notes")
        return {"success": True, "notes": result["notes"], "total": result["total"]}

    @mcp.tool()
    def add_note(context: Context, case_id: int, content: str) -> dict:
        """Add a note to a case."""
        error = check_empty_required_field(content, "content")
        if error:
            return error

        context.info(f"Adding note to case {case_id}")
        result = db.add_note(case_id, content)
        if not result:
            return not_found_error("Case")
        context.info(f"Note created with ID {result.get('id')}")
        return {"success": True, "note": result}

    @mcp.tool()
    def update_note(context: Context, note_id: int, content: str) -> dict:
        """Update a note's content."""
        error = check_empty_required_field(content, "content")
        if error:
            return error

        context.info(f"Updating note {note_id}")
        result = db.update_note(note_id, content)
        if not result:
            return not_found_error("Note")
        context.info(f"Note {note_id} updated successfully")
        return {"success": True, "note": result}

    @mcp.tool()
    def delete_note(context: Context, note_id: int) -> dict:
        """Delete a note."""
        context.info(f"Deleting note {note_id}")
        if db.delete_note(note_id):
            context.info(f"Note {note_id} deleted successfully")
            return {"success": True, "message": "Note deleted"}
        return not_found_error("Note")
