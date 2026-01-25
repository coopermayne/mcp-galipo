"""
Jurisdiction (Court) MCP Tools

Tools for managing jurisdictions/courts in the legal case management system.
"""

from typing import Optional
from mcp.server.fastmcp import Context
import database as db
from tools.utils import validation_error, not_found_error, check_empty_required_field


def register_jurisdiction_tools(mcp):
    """Register jurisdiction-related MCP tools."""

    @mcp.tool()
    def list_jurisdictions(context: Context) -> dict:
        """List all jurisdictions (courts)."""
        context.info("Fetching all jurisdictions")
        jurisdictions = db.get_jurisdictions()
        context.info(f"Found {len(jurisdictions)} jurisdictions")
        return {"success": True, "jurisdictions": jurisdictions, "total": len(jurisdictions)}

    @mcp.tool()
    def manage_jurisdiction(
        context: Context,
        name: str,
        jurisdiction_id: Optional[int] = None,
        local_rules_link: Optional[str] = None,
        notes: Optional[str] = None
    ) -> dict:
        """Create or update a jurisdiction (court)."""
        error = check_empty_required_field(name, "name")
        if error:
            return error

        if jurisdiction_id:
            context.info(f"Updating jurisdiction {jurisdiction_id}: {name}")
            result = db.update_jurisdiction(jurisdiction_id, name, local_rules_link, notes)
            if not result:
                return not_found_error("Jurisdiction")
            context.info(f"Jurisdiction {jurisdiction_id} updated successfully")
            return {"success": True, "jurisdiction": result, "action": "updated"}
        else:
            context.info(f"Creating new jurisdiction: {name}")
            result = db.create_jurisdiction(name, local_rules_link, notes)
            context.info(f"Jurisdiction created with ID {result.get('id')}")
            return {"success": True, "jurisdiction": result, "action": "created"}

    @mcp.tool()
    def delete_jurisdiction(context: Context, jurisdiction_id: int) -> dict:
        """Delete a jurisdiction (court)."""
        context.info(f"Deleting jurisdiction {jurisdiction_id}")
        if db.delete_jurisdiction(jurisdiction_id):
            context.info(f"Jurisdiction {jurisdiction_id} deleted")
            return {"success": True, "message": "Jurisdiction deleted"}
        return not_found_error(
            "Jurisdiction",
            hint="The jurisdiction may not exist, or it may still have proceedings assigned to it. Reassign those proceedings first."
        )
