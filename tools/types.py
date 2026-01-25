"""
Type Management MCP Tools

Tools for managing expertise types and person types in the legal case management system.
"""

from typing import Optional
from mcp.server.fastmcp import Context
import database as db
from tools.utils import validation_error, not_found_error, check_empty_required_field


def register_type_tools(mcp):
    """Register type management MCP tools."""

    @mcp.tool()
    def manage_expertise_type(
        context: Context,
        name: str = "",
        description: Optional[str] = None,
        expertise_type_id: Optional[int] = None,
        list_all: bool = False
    ) -> dict:
        """Create, update, or list expertise types."""
        if list_all:
            context.info("Fetching all expertise types")
            types = db.get_expertise_types()
            context.info(f"Found {len(types)} expertise types")
            return {"success": True, "expertise_types": types, "total": len(types)}

        if expertise_type_id:
            # Update existing
            context.info(f"Updating expertise type {expertise_type_id}")
            result = db.update_expertise_type(expertise_type_id, name if name else None, description)
            if not result:
                return not_found_error("Expertise type")
            context.info(f"Expertise type {expertise_type_id} updated")
            return {"success": True, "expertise_type": result, "action": "updated"}

        if not name:
            return validation_error(
                "Name is required when creating",
                hint="Provide a name for the expertise type, or use list_all=True to see existing types",
                example={"name": "Biomechanics", "description": "Expert in human body mechanics"}
            )

        context.info(f"Creating expertise type: {name}")
        result = db.create_expertise_type(name, description)
        context.info(f"Expertise type created")
        return {"success": True, "expertise_type": result, "action": "created"}

    @mcp.tool()
    def delete_expertise_type(context: Context, expertise_type_id: int) -> dict:
        """Delete an expertise type."""
        context.info(f"Deleting expertise type {expertise_type_id}")
        if db.delete_expertise_type(expertise_type_id):
            context.info(f"Expertise type {expertise_type_id} deleted")
            return {"success": True, "message": "Expertise type deleted"}
        return not_found_error("Expertise type")

    @mcp.tool()
    def manage_person_type(
        context: Context,
        name: str = "",
        description: Optional[str] = None,
        person_type_id: Optional[int] = None,
        list_all: bool = False
    ) -> dict:
        """Create, update, or list person types."""
        if list_all:
            context.info("Fetching all person types")
            types = db.get_person_types()
            context.info(f"Found {len(types)} person types")
            return {"success": True, "person_types": types, "total": len(types)}

        if person_type_id:
            # Update existing
            context.info(f"Updating person type {person_type_id}")
            result = db.update_person_type(person_type_id, name if name else None, description)
            if not result:
                return not_found_error("Person type")
            context.info(f"Person type {person_type_id} updated")
            return {"success": True, "person_type": result, "action": "updated"}

        if not name:
            return validation_error(
                "Name is required when creating",
                hint="Provide a name for the person type, or use list_all=True to see existing types",
                example={"name": "paralegal", "description": "Paralegal or legal assistant"}
            )

        context.info(f"Creating person type: {name}")
        result = db.create_person_type(name, description)
        context.info(f"Person type created")
        return {"success": True, "person_type": result, "action": "created"}

    @mcp.tool()
    def delete_person_type(context: Context, person_type_id: int) -> dict:
        """Delete a person type."""
        context.info(f"Deleting person type {person_type_id}")
        if db.delete_person_type(person_type_id):
            context.info(f"Person type {person_type_id} deleted")
            return {"success": True, "message": "Person type deleted"}
        return not_found_error("Person type")
