"""
Person MCP Tools

Tools for managing persons (clients, attorneys, judges, experts, etc.) in the system.
"""

from typing import Optional
from mcp.server.fastmcp import Context
import database as db
from database import ValidationError
from tools.utils import validation_error, not_found_error, PersonSide


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
        """
        Create or update a person (unified person management).

        Person types are flexible - common types include: client, attorney, judge,
        expert, mediator, defendant, witness, lien_holder, interpreter, etc.

        Type-specific attributes (stored in attributes JSONB field):
        - judge: {status, jurisdiction, chambers, courtroom_number, appointed_by, initials, tenure}
        - expert: {hourly_rate, deposition_rate, trial_rate, expertises: ["Biomechanics", "..."]}
        - attorney: {bar_number}
        - mediator: {half_day_rate, full_day_rate, style}
        - client: {date_of_birth, preferred_language, emergency_contact}

        Args:
            name: Full name (required)
            person_type: Type of person (required, any string)
            person_id: ID if updating existing person (omit to create new)
            phones: List of phone objects [{value: "555-1234", label: "Cell", primary: true}]
            emails: List of email objects [{value: "email@example.com", label: "Work", primary: true}]
            address: Physical address
            organization: Firm, court, or company name
            attributes: Type-specific attributes as JSON object
            notes: General notes
            archived: Whether to archive/unarchive the person

        Returns the created/updated person.

        Examples:
            Create expert: manage_person(name="Dr. Smith", person_type="expert",
                          organization="Smith Biomechanics",
                          phones=[{"value": "555-1234", "label": "Office"}],
                          attributes={"hourly_rate": 500, "expertises": ["Biomechanics"]})
            Create judge: manage_person(name="Hon. Jane Doe", person_type="judge",
                         organization="C.D. Cal.", attributes={"courtroom_number": "5A"})
            Create witness: manage_person(name="John Doe", person_type="witness")
            Update: manage_person(name="Dr. Smith", person_type="expert", person_id=5,
                   attributes={"hourly_rate": 550})
        """
        try:
            db.validate_person_type(person_type)
        except ValidationError as e:
            return validation_error(str(e))

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
            return {"success": True, "person": result, "action": "updated"}
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
            return {"success": True, "person": result, "action": "created"}

    @mcp.tool()
    def search_persons(
        context: Context,
        name: Optional[str] = None,
        person_type: Optional[str] = None,
        organization: Optional[str] = None,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        case_id: Optional[int] = None,
        include_archived: bool = False,
        limit: int = 50
    ) -> dict:
        """
        Universal search for persons by name, type, attributes, or case.

        Args:
            name: Name to search (partial match)
            person_type: Filter by type (any type string, e.g., client, attorney, judge, expert, witness)
            organization: Organization to search (partial match)
            email: Email to search (partial match in emails array)
            phone: Phone to search (partial match in phones array)
            case_id: Filter by case assignment
            include_archived: Include archived persons (default False)
            limit: Max results (default 50)

        Returns list of matching persons with basic info.

        Examples:
            search_persons(person_type="expert")
            search_persons(name="Smith", person_type="attorney")
            search_persons(case_id=5)
        """
        context.info(f"Searching persons{' type=' + person_type if person_type else ''}{' name=' + name if name else ''}")
        result = db.search_persons(
            name=name,
            person_type=person_type,
            organization=organization,
            email=email,
            phone=phone,
            case_id=case_id,
            archived=include_archived,
            limit=limit
        )
        context.info(f"Found {result['total']} matching persons")
        return {
            "success": True,
            "persons": result["persons"],
            "total": result["total"],
            "filters": {
                "name": name,
                "person_type": person_type,
                "organization": organization,
                "case_id": case_id
            }
        }

    @mcp.tool()
    def get_person(context: Context, person_id: int) -> dict:
        """
        Get full details for a person including all case assignments.

        Args:
            person_id: ID of the person

        Returns complete person details with:
        - Basic info (name, type, phones, emails, address, organization)
        - Type-specific attributes (in JSONB)
        - All case assignments with roles
        """
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
        """
        Link a person to a case with a specific role and case-specific data.

        Common roles: Client, Defendant, Opposing Counsel, Co-Counsel, Judge,
        Magistrate Judge, Plaintiff Expert, Defendant Expert, Mediator, Witness

        Args:
            case_id: ID of the case
            person_id: ID of the person
            role: Role in the case (e.g., 'Client', 'Defendant', 'Opposing Counsel', 'Judge')
            side: Which side of the case this person is on
            case_attributes: Case-specific overrides/data as JSON
                - Expert: {case_rate, testimony_topics, report_due, deposition_date}
                - Judge: {panel_position, oral_argument_date}
                - Attorney: {billing_rate, responsible_for}
            case_notes: Case-specific notes
            is_primary: Whether this is the primary person for this role
            contact_via_person_id: ID of person to contact through (if not direct contact)
            assigned_date: Date assigned (YYYY-MM-DD)

        Returns the created assignment.

        Examples:
            assign_person_to_case(case_id=1, person_id=5, role="Plaintiff Expert",
                                 side="plaintiff", case_attributes={"case_rate": 600})
            assign_person_to_case(case_id=1, person_id=10, role="Judge", side="neutral")
            assign_person_to_case(case_id=1, person_id=2, role="Client",
                                 contact_via_person_id=3)  # Contact through person 3
        """
        context.info(f"Assigning person {person_id} to case {case_id} as {role}")
        try:
            if side:
                db.validate_person_side(side)
            if assigned_date:
                db.validate_date_format(assigned_date, "assigned_date")
        except ValidationError as e:
            return validation_error(str(e))

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
        context.info(f"Person {person_id} assigned to case {case_id} successfully")
        return {"success": True, "assignment": result}

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
        """
        Update case-specific attributes for a person's assignment.

        Args:
            case_id: ID of the case
            person_id: ID of the person
            role: Role to update (required to identify the assignment)
            side: Update which side of the case
            case_attributes: Update case-specific attributes
            case_notes: Update case-specific notes
            is_primary: Update primary status
            contact_via_person_id: Update contact via person (set to None for direct contact)
            assigned_date: Update assigned date

        Returns the updated assignment.
        """
        context.info(f"Updating assignment for person {person_id} in case {case_id}")
        try:
            if side:
                db.validate_person_side(side)
            if assigned_date:
                db.validate_date_format(assigned_date, "assigned_date")
        except ValidationError as e:
            return validation_error(str(e))

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
            return not_found_error("Case assignment")
        context.info(f"Assignment updated successfully")
        return {"success": True, "assignment": result}

    @mcp.tool()
    def remove_person_from_case(
        context: Context,
        case_id: int,
        person_id: int,
        role: Optional[str] = None
    ) -> dict:
        """
        Unlink a person from a case.

        Args:
            case_id: ID of the case
            person_id: ID of the person
            role: Specific role to remove (if None, removes all roles)

        Returns confirmation.
        """
        context.info(f"Removing person {person_id} from case {case_id}{' role=' + role if role else ''}")
        result = db.remove_person_from_case(case_id, person_id, role)
        if not result:
            return not_found_error("Case assignment")
        context.info(f"Person {person_id} removed from case {case_id}")
        return {
            "success": True,
            "message": f"Person {person_id} removed from case {case_id}" +
                      (f" (role: {role})" if role else " (all roles)")
        }
