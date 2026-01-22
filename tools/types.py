"""
Type Management MCP Tools

Tools for managing expertise types and person types in the legal case management system.
"""

from typing import Optional
from mcp.server.fastmcp import Context
import database as db
from tools.utils import validation_error, not_found_error


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
        """
        Create, update, or list expertise types.

        Expertise types are used to categorize expert witnesses (e.g., Biomechanics,
        Accident Reconstruction, Medical - Orthopedic).

        Args:
            name: Name of the expertise type (required for create/update)
            description: Description of the expertise type
            expertise_type_id: ID if updating existing type (omit to create new)
            list_all: Set to True to just list all expertise types

        Returns the created/updated type or list of all types.

        Examples:
            manage_expertise_type(list_all=True)
            manage_expertise_type(name="Digital Forensics", description="Computer and phone forensics")
            manage_expertise_type(expertise_type_id=5, name="Digital Forensics - Updated")
        """
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
            return validation_error("Name is required when creating")

        context.info(f"Creating expertise type: {name}")
        result = db.create_expertise_type(name, description)
        context.info(f"Expertise type created")
        return {"success": True, "expertise_type": result, "action": "created"}

    @mcp.tool()
    def delete_expertise_type(context: Context, expertise_type_id: int) -> dict:
        """
        Delete an expertise type.

        Args:
            expertise_type_id: ID of the expertise type to delete

        Returns confirmation.
        """
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
        """
        Create, update, or list person types.

        Person types categorize people in the system (e.g., client, attorney, judge,
        expert, witness, lien_holder, interpreter).

        Args:
            name: Name of the person type (required for create/update)
            description: Description of the person type
            person_type_id: ID if updating existing type (omit to create new)
            list_all: Set to True to just list all person types

        Returns the created/updated type or list of all types.

        Examples:
            manage_person_type(list_all=True)
            manage_person_type(name="paralegal", description="Paralegal or legal assistant")
            manage_person_type(person_type_id=3, name="attorney", description="Updated description")
        """
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
            return validation_error("Name is required when creating")

        context.info(f"Creating person type: {name}")
        result = db.create_person_type(name, description)
        context.info(f"Person type created")
        return {"success": True, "person_type": result, "action": "created"}

    @mcp.tool()
    def delete_person_type(context: Context, person_type_id: int) -> dict:
        """
        Delete a person type.

        Args:
            person_type_id: ID of the person type to delete

        Returns confirmation.
        """
        context.info(f"Deleting person type {person_type_id}")
        if db.delete_person_type(person_type_id):
            context.info(f"Person type {person_type_id} deleted")
            return {"success": True, "message": "Person type deleted"}
        return not_found_error("Person type")
