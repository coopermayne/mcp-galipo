"""
Person MCP Tools

Tools for managing persons (clients, attorneys, judges, experts, etc.) in the system.
"""

from typing import Optional
from mcp.server.fastmcp import Context
import database as db
from database import ValidationError
from tools.utils import (
    validation_error, not_found_error, PersonSide,
    invalid_side_error, invalid_date_format_error,
    judge_role_on_case_error, person_type_attributes_hint,
    COMMON_PERSON_TYPES, COMMON_ROLES
)


def register_person_tools(mcp):
    """Register person-related MCP tools."""

    @mcp.tool()
    def manage_person(
        context: Context,
        name: str,
        person_type: str,
        person_id: Optional[int] = None,
        phones: Optional[list] = None,
        emails: Optional[list] = None,
        address: Optional[str] = None,
        organization: Optional[str] = None,
        attributes: Optional[dict] = None,
        notes: Optional[str] = None,
        archived: Optional[bool] = None
    ) -> dict:
        """Create or update a person."""
        try:
            db.validate_person_type(person_type)
        except ValidationError as e:
            return validation_error(
                str(e),
                hint=f"Common types: {', '.join(COMMON_PERSON_TYPES)}"
            )

        # Provide attribute guidance in the response
        attr_hint = person_type_attributes_hint(person_type)

        if person_id:
            # Update existing person
            context.info(f"Updating person {person_id}: {name}")
            result = db.update_person(
                person_id,
                name=name,
                person_type=person_type,
                phones=phones,
                emails=emails,
                address=address,
                organization=organization,
                attributes=attributes,
                notes=notes,
                archived=archived
            )
            if not result:
                return not_found_error("Person")

            context.info(f"Person {person_id} updated successfully")
            response = {"success": True, "person": result, "action": "updated"}
            if attr_hint and not attributes:
                response["attribute_hint"] = attr_hint
            return response
        else:
            # Create new person
            context.info(f"Creating new {person_type}: {name}")
            result = db.create_person(
                person_type=person_type,
                name=name,
                phones=phones,
                emails=emails,
                address=address,
                organization=organization,
                attributes=attributes,
                notes=notes
            )

            context.info(f"Person created with ID {result.get('id')}")
            response = {"success": True, "person": result, "action": "created"}
            if attr_hint and not attributes:
                response["attribute_hint"] = attr_hint
            return response

    @mcp.tool()
    def get_person(context: Context, person_id: int) -> dict:
        """Get full details for a person including all case assignments."""
        context.info(f"Fetching person {person_id}")
        result = db.get_person_by_id(person_id)
        if not result:
            return not_found_error("Person")
        context.info(f"Retrieved person: {result.get('name', 'Unknown')}")
        return {"success": True, "person": result}

    @mcp.tool()
    def assign_person_to_case(
        context: Context,
        case_id: int,
        person_id: int,
        role: str,
        side: Optional[PersonSide] = None,
        case_attributes: Optional[dict] = None,
        case_notes: Optional[str] = None,
        is_primary: bool = False,
        contact_via_person_id: Optional[int] = None,
        assigned_date: Optional[str] = None
    ) -> dict:
        """Link a person to a case with a specific role."""
        context.info(f"Assigning person {person_id} to case {case_id} as {role}")

        # Check for judge role - should go on proceedings instead
        if role in ["Judge", "Magistrate Judge"]:
            return judge_role_on_case_error(role)

        if side:
            try:
                db.validate_person_side(side)
            except ValidationError:
                return invalid_side_error(side)

        if assigned_date:
            try:
                db.validate_date_format(assigned_date, "assigned_date")
            except ValidationError:
                return invalid_date_format_error(assigned_date, "assigned_date")

        result = db.assign_person_to_case(
            case_id=case_id,
            person_id=person_id,
            role=role,
            side=side,
            case_attributes=case_attributes,
            case_notes=case_notes,
            is_primary=is_primary,
            contact_via_person_id=contact_via_person_id,
            assigned_date=assigned_date
        )

        if not result:
            # Could be case not found or person not found
            return validation_error(
                "Could not create assignment",
                hint="Verify both case_id and person_id exist",
                suggestion="Use get_case(case_id=N) and get_person(person_id=N) to verify"
            )

        context.info(f"Person {person_id} assigned to case {case_id} successfully")
        response = {"success": True, "assignment": result}

        # Add hint about common roles if role seems unusual
        if role not in COMMON_ROLES:
            response["note"] = f"Role '{role}' created. Common roles: {', '.join(COMMON_ROLES[:5])}..."

        return response

    @mcp.tool()
    def update_case_assignment(
        context: Context,
        case_id: int,
        person_id: int,
        role: str,
        side: Optional[PersonSide] = None,
        case_attributes: Optional[dict] = None,
        case_notes: Optional[str] = None,
        is_primary: Optional[bool] = None,
        contact_via_person_id: Optional[int] = None,
        assigned_date: Optional[str] = None
    ) -> dict:
        """Update case-specific attributes for a person's assignment."""
        context.info(f"Updating assignment for person {person_id} in case {case_id}")

        if side:
            try:
                db.validate_person_side(side)
            except ValidationError:
                return invalid_side_error(side)

        if assigned_date:
            try:
                db.validate_date_format(assigned_date, "assigned_date")
            except ValidationError:
                return invalid_date_format_error(assigned_date, "assigned_date")

        result = db.update_case_assignment(
            case_id=case_id,
            person_id=person_id,
            role=role,
            side=side,
            case_attributes=case_attributes,
            case_notes=case_notes,
            is_primary=is_primary,
            contact_via_person_id=contact_via_person_id,
            assigned_date=assigned_date
        )
        if not result:
            return not_found_error(
                "Case assignment",
                hint=f"No assignment found for person {person_id} with role '{role}' in case {case_id}"
            )
        context.info(f"Assignment updated successfully")
        return {"success": True, "assignment": result}

    @mcp.tool()
    def remove_person_from_case(
        context: Context,
        case_id: int,
        person_id: int,
        role: Optional[str] = None
    ) -> dict:
        """Unlink a person from a case."""
        context.info(f"Removing person {person_id} from case {case_id}{' role=' + role if role else ''}")
        result = db.remove_person_from_case(case_id, person_id, role)
        if not result:
            return not_found_error(
                "Case assignment",
                hint=f"Person {person_id} may not be assigned to case {case_id}" +
                     (f" with role '{role}'" if role else "")
            )
        context.info(f"Person {person_id} removed from case {case_id}")
        return {
            "success": True,
            "message": f"Person {person_id} removed from case {case_id}" +
                      (f" (role: {role})" if role else " (all roles)")
        }
