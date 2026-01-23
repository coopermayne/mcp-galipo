"""
Proceeding MCP Tools

Tools for managing court proceedings within cases. A single case (matter) can have
multiple proceedings across different courts (e.g., state court -> federal removal -> appeal).

Each proceeding can have multiple judges (for panels, magistrate+judge combos, etc.)
via the proceeding_judges relationship.
"""

from typing import Optional
from mcp.server.fastmcp import Context
import database as db
from tools.utils import validation_error, not_found_error


def register_proceeding_tools(mcp):
    """Register proceeding-related MCP tools."""

    @mcp.tool()
    def add_proceeding(
        context: Context,
        case_id: int,
        case_number: str,
        jurisdiction_id: Optional[int] = None,
        is_primary: bool = False,
        notes: Optional[str] = None
    ) -> dict:
        """
        Add a court proceeding to a case.

        A proceeding represents a court filing within a case. A single case (matter) can have
        multiple proceedings across different courts. For example:
        - Initial state court filing
        - Federal court after removal
        - Appellate court filing
        - Separate public records case

        After creating a proceeding, use add_proceeding_judge to assign judges.

        Args:
            case_id: ID of the case
            case_number: The court case number (e.g., "2:24-cv-01234")
            jurisdiction_id: ID of the jurisdiction/court (use get_jurisdictions to see options)
            is_primary: Whether this is the primary/main proceeding for the case
            notes: Additional notes about this proceeding

        Returns the created proceeding with jurisdiction info.

        Examples:
            - add_proceeding(case_id=5, case_number="BC123456", jurisdiction_id=1)
            - add_proceeding(case_id=5, case_number="2:24-cv-01234", jurisdiction_id=2, is_primary=True)
        """
        context.info(f"Adding proceeding to case {case_id}: {case_number}")

        if not case_number or not case_number.strip():
            return validation_error("case_number is required")

        result = db.add_proceeding(
            case_id=case_id,
            case_number=case_number.strip(),
            jurisdiction_id=jurisdiction_id,
            is_primary=is_primary,
            notes=notes
        )
        context.info(f"Proceeding created with ID {result.get('id')}")
        return {"success": True, "proceeding": result}

    @mcp.tool()
    def get_proceedings(
        context: Context,
        case_id: int
    ) -> dict:
        """
        Get all proceedings for a case.

        Returns a list of proceedings with jurisdiction and judge information.
        Each proceeding includes a 'judges' array with all assigned judges.

        Args:
            case_id: ID of the case

        Returns list of proceedings sorted by sort_order.
        Each proceeding includes: id, case_number, jurisdiction_name, judges[], is_primary, notes.
        """
        context.info(f"Fetching proceedings for case {case_id}")
        proceedings = db.get_proceedings(case_id)
        context.info(f"Found {len(proceedings)} proceedings")
        return {"proceedings": proceedings, "total": len(proceedings)}

    @mcp.tool()
    def update_proceeding(
        context: Context,
        proceeding_id: int,
        case_number: Optional[str] = None,
        jurisdiction_id: Optional[int] = None,
        is_primary: Optional[bool] = None,
        notes: Optional[str] = None
    ) -> dict:
        """
        Update a proceeding's basic info.

        To manage judges, use add_proceeding_judge and remove_proceeding_judge.

        Args:
            proceeding_id: ID of the proceeding to update
            case_number: New case number
            jurisdiction_id: New jurisdiction ID (pass 0 to clear)
            is_primary: Whether this is the primary proceeding (setting True will unset others)
            notes: New notes (pass "" to clear)

        Returns updated proceeding.
        """
        context.info(f"Updating proceeding {proceeding_id}")

        kwargs = {}
        if case_number is not None:
            if case_number == "":
                return validation_error("case_number cannot be empty")
            kwargs['case_number'] = case_number

        if jurisdiction_id is not None:
            kwargs['jurisdiction_id'] = jurisdiction_id if jurisdiction_id != 0 else None

        if is_primary is not None:
            kwargs['is_primary'] = is_primary

        if notes is not None:
            kwargs['notes'] = notes if notes != "" else None

        if not kwargs:
            return validation_error("No fields to update")

        result = db.update_proceeding(proceeding_id, **kwargs)
        if not result:
            return not_found_error("Proceeding")
        context.info(f"Proceeding {proceeding_id} updated successfully")
        return {"success": True, "proceeding": result}

    @mcp.tool()
    def delete_proceeding(
        context: Context,
        proceeding_id: int
    ) -> dict:
        """
        Delete a proceeding.

        This also removes all judge assignments for this proceeding.

        Args:
            proceeding_id: ID of the proceeding to delete

        Returns confirmation.
        """
        context.info(f"Deleting proceeding {proceeding_id}")
        if db.delete_proceeding(proceeding_id):
            context.info(f"Proceeding {proceeding_id} deleted successfully")
            return {"success": True, "message": "Proceeding deleted"}
        return not_found_error("Proceeding")

    # =========================================================================
    # Proceeding Judges Tools
    # =========================================================================

    @mcp.tool()
    def add_proceeding_judge(
        context: Context,
        proceeding_id: int,
        person_id: int,
        role: str = "Judge",
        sort_order: Optional[int] = None
    ) -> dict:
        """
        Add a judge to a proceeding.

        A proceeding can have multiple judges (for panels, magistrate+judge combos, etc.).
        The same person can have multiple roles (e.g., both "Judge" and "Magistrate").

        Args:
            proceeding_id: ID of the proceeding
            person_id: ID of the judge (must be a person, typically with type 'judge')
            role: Role on this proceeding - "Judge", "Presiding", "Panel", or "Magistrate"
            sort_order: Display order (auto-assigned if not provided)

        Returns the created judge assignment with person name.

        Examples:
            - add_proceeding_judge(proceeding_id=1, person_id=5)
            - add_proceeding_judge(proceeding_id=1, person_id=6, role="Magistrate")
        """
        context.info(f"Adding judge {person_id} to proceeding {proceeding_id} as {role}")

        result = db.add_judge_to_proceeding(
            proceeding_id=proceeding_id,
            person_id=person_id,
            role=role,
            sort_order=sort_order
        )
        context.info(f"Judge added: {result.get('name')}")
        return {"success": True, "judge": result}

    @mcp.tool()
    def remove_proceeding_judge(
        context: Context,
        proceeding_id: int,
        person_id: int
    ) -> dict:
        """
        Remove a judge from a proceeding.

        Args:
            proceeding_id: ID of the proceeding
            person_id: ID of the judge to remove

        Returns confirmation.

        Examples:
            - remove_proceeding_judge(proceeding_id=1, person_id=5)
        """
        context.info(f"Removing judge {person_id} from proceeding {proceeding_id}")

        if db.remove_judge_from_proceeding(proceeding_id, person_id):
            context.info("Judge removed successfully")
            return {"success": True, "message": "Judge removed from proceeding"}
        return not_found_error("Judge assignment")

    @mcp.tool()
    def get_proceeding_judges(
        context: Context,
        proceeding_id: int
    ) -> dict:
        """
        Get all judges for a proceeding.

        Args:
            proceeding_id: ID of the proceeding

        Returns list of judges with their roles, sorted by sort_order.
        Each judge includes: person_id, name, role, sort_order.
        """
        context.info(f"Fetching judges for proceeding {proceeding_id}")
        judges = db.get_proceeding_judges(proceeding_id)
        context.info(f"Found {len(judges)} judges")
        return {"judges": judges, "total": len(judges)}

    @mcp.tool()
    def update_proceeding_judge(
        context: Context,
        proceeding_id: int,
        person_id: int,
        role: Optional[str] = None,
        sort_order: Optional[int] = None
    ) -> dict:
        """
        Update a judge's role or sort_order on a proceeding.

        Args:
            proceeding_id: ID of the proceeding
            person_id: ID of the judge
            role: New role (if changing the role)
            sort_order: New sort order

        Returns updated judge assignment.

        Examples:
            - update_proceeding_judge(proceeding_id=1, person_id=5, role="Presiding")
            - update_proceeding_judge(proceeding_id=1, person_id=5, sort_order=1)
        """
        context.info(f"Updating judge {person_id} on proceeding {proceeding_id}")

        if role is None and sort_order is None:
            return validation_error("Must provide role or sort_order to update")

        result = db.update_proceeding_judge(
            proceeding_id=proceeding_id,
            person_id=person_id,
            role=role,
            sort_order=sort_order
        )
        if not result:
            return not_found_error("Judge assignment")
        context.info("Judge updated successfully")
        return {"success": True, "judge": result}
