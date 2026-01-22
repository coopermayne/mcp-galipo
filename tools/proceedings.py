"""
Proceeding MCP Tools

Tools for managing court proceedings within cases. A single case (matter) can have
multiple proceedings across different courts (e.g., state court -> federal removal -> appeal).
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
        judge_id: Optional[int] = None,
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

        Args:
            case_id: ID of the case
            case_number: The court case number (e.g., "2:24-cv-01234")
            jurisdiction_id: ID of the jurisdiction/court (use get_jurisdictions to see options)
            judge_id: ID of the assigned judge (must be a person with type 'judge')
            is_primary: Whether this is the primary/main proceeding for the case
            notes: Additional notes about this proceeding

        Returns the created proceeding with jurisdiction and judge names.

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
            judge_id=judge_id,
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

        Args:
            case_id: ID of the case

        Returns list of proceedings sorted by sort_order.
        Each proceeding includes: id, case_number, jurisdiction_name, judge_name, is_primary, notes.
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
        judge_id: Optional[int] = None,
        is_primary: Optional[bool] = None,
        notes: Optional[str] = None
    ) -> dict:
        """
        Update a proceeding.

        Args:
            proceeding_id: ID of the proceeding to update
            case_number: New case number
            jurisdiction_id: New jurisdiction ID
            judge_id: New judge ID (person ID)
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

        if judge_id is not None:
            kwargs['judge_id'] = judge_id if judge_id != 0 else None

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

        Args:
            proceeding_id: ID of the proceeding to delete

        Returns confirmation.
        """
        context.info(f"Deleting proceeding {proceeding_id}")
        if db.delete_proceeding(proceeding_id):
            context.info(f"Proceeding {proceeding_id} deleted successfully")
            return {"success": True, "message": "Proceeding deleted"}
        return not_found_error("Proceeding")
