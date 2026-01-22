"""
Jurisdiction (Court) MCP Tools

Tools for managing jurisdictions/courts in the legal case management system.
"""

from typing import Optional
from mcp.server.fastmcp import Context
import database as db
from tools.utils import not_found_error


def register_jurisdiction_tools(mcp):
    """Register jurisdiction-related MCP tools."""

    @mcp.tool()
    def list_jurisdictions(context: Context) -> dict:
        """
        List all jurisdictions (courts).

        Returns list of jurisdictions with id, name, local_rules_link, and notes.
        """
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
        """
        Create or update a jurisdiction (court).

        Args:
            name: Name of the jurisdiction (e.g., "C.D. Cal.", "Los Angeles Superior")
            jurisdiction_id: ID if updating existing jurisdiction (omit to create new)
            local_rules_link: URL to local rules
            notes: Additional notes

        Returns the created/updated jurisdiction.
        """
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
        """
        Delete a jurisdiction (court).

        Note: This will fail if any cases are still assigned to this jurisdiction.
        Reassign those cases to a different jurisdiction first.

        Args:
            jurisdiction_id: ID of the jurisdiction to delete

        Returns confirmation.
        """
        context.info(f"Deleting jurisdiction {jurisdiction_id}")
        if db.delete_jurisdiction(jurisdiction_id):
            context.info(f"Jurisdiction {jurisdiction_id} deleted")
            return {"success": True, "message": "Jurisdiction deleted"}
        return not_found_error("Jurisdiction")
