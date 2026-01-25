"""
Proceeding MCP Tools

Tools for managing court proceedings within cases. A single case (matter) can have
multiple proceedings across different courts (e.g., state court -> federal removal -> appeal).

Each proceeding can have multiple judges (for panels, magistrate+judge combos, etc.)
via the judges relationship.
"""

from typing import Optional
from mcp.server.fastmcp import Context
import database as db
from tools.utils import validation_error, not_found_error, check_empty_required_field


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
        """Add a court proceeding to a case."""
        context.info(f"Adding proceeding to case {case_id}: {case_number}")

        error = check_empty_required_field(case_number, "case_number")
        if error:
            return error

        result = db.add_proceeding(
            case_id=case_id,
            case_number=case_number.strip(),
            jurisdiction_id=jurisdiction_id,
            is_primary=is_primary,
            notes=notes
        )
        if not result:
            return not_found_error(
                "Case",
                hint="The case_id must exist before adding a proceeding",
                suggestion="Use get_case(case_id=N) to verify the case exists"
            )
        context.info(f"Proceeding created with ID {result.get('id')}")

        response = {"success": True, "proceeding": result}
        if not jurisdiction_id:
            response["note"] = "No jurisdiction set. Use list_jurisdictions() to see available courts, then update_proceeding() to assign one."
        return response

    @mcp.tool()
    def get_proceedings(
        context: Context,
        case_id: int
    ) -> dict:
        """Get all proceedings for a case."""
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
        """Update a proceeding's basic info."""
        context.info(f"Updating proceeding {proceeding_id}")

        kwargs = {}
        if case_number is not None:
            error = check_empty_required_field(case_number, "case_number")
            if error:
                return error
            kwargs['case_number'] = case_number

        if jurisdiction_id is not None:
            # 0 means clear the jurisdiction
            kwargs['jurisdiction_id'] = jurisdiction_id if jurisdiction_id != 0 else None

        if is_primary is not None:
            kwargs['is_primary'] = is_primary

        if notes is not None:
            kwargs['notes'] = notes if notes != "" else None

        if not kwargs:
            return validation_error(
                "No fields to update",
                hint="Provide at least one of: case_number, jurisdiction_id, is_primary, notes. Pass 0 for jurisdiction_id to clear it."
            )

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
        """Delete a proceeding."""
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
        """Add a judge to a proceeding."""
        context.info(f"Adding judge {person_id} to proceeding {proceeding_id} as {role}")

        # Validate role
        valid_roles = ["Judge", "Presiding", "Panel", "Magistrate Judge"]
        if role not in valid_roles:
            return validation_error(
                f"Invalid judge role: '{role}'",
                valid_values=valid_roles,
                hint="Use 'Judge' for standard assignments, 'Magistrate Judge' for magistrates"
            )

        result = db.add_judge_to_proceeding(
            proceeding_id=proceeding_id,
            person_id=person_id,
            role=role,
            sort_order=sort_order
        )
        if not result:
            return validation_error(
                "Could not add judge to proceeding",
                hint="Verify both proceeding_id and person_id exist",
                suggestion="Use get_proceedings(case_id=N) and search_persons(person_type='judge') to verify"
            )
        context.info(f"Judge added: {result.get('name')}")
        return {"success": True, "judge": result}

    @mcp.tool()
    def remove_proceeding_judge(
        context: Context,
        proceeding_id: int,
        person_id: int
    ) -> dict:
        """Remove a judge from a proceeding."""
        context.info(f"Removing judge {person_id} from proceeding {proceeding_id}")

        if db.remove_judge_from_proceeding(proceeding_id, person_id):
            context.info("Judge removed successfully")
            return {"success": True, "message": "Judge removed from proceeding"}
        return not_found_error(
            "Judge assignment",
            hint=f"Person {person_id} may not be assigned to proceeding {proceeding_id}"
        )

    @mcp.tool()
    def get_judges(
        context: Context,
        proceeding_id: int
    ) -> dict:
        """Get all judges for a proceeding."""
        context.info(f"Fetching judges for proceeding {proceeding_id}")
        judges = db.get_judges(proceeding_id)
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
        """Update a judge's role or sort_order on a proceeding."""
        context.info(f"Updating judge {person_id} on proceeding {proceeding_id}")

        if role is None and sort_order is None:
            return validation_error(
                "No fields to update",
                hint="Provide role and/or sort_order to update"
            )

        if role:
            valid_roles = ["Judge", "Presiding", "Panel", "Magistrate Judge"]
            if role not in valid_roles:
                return validation_error(
                    f"Invalid judge role: '{role}'",
                    valid_values=valid_roles
                )

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
