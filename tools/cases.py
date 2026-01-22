"""
Case MCP Tools

Tools for managing legal cases in the system.
"""

from typing import Optional
from mcp.server.fastmcp import Context
import database as db
from database import ValidationError
from tools.utils import validation_error, not_found_error


def register_case_tools(mcp):
    """Register case-related MCP tools."""

    @mcp.tool()
    def list_cases(context: Context, status_filter: Optional[str] = None) -> dict:
        """
        List all cases with optional status filter.

        Args:
            status_filter: Optional status to filter by (e.g., "Discovery", "Pre-trial")
                          Valid statuses: Signing Up, Prospective, Pre-Filing, Pleadings,
                          Discovery, Expert Discovery, Pre-trial, Trial, Post-Trial,
                          Appeal, Settl. Pend., Stayed, Closed

        Returns list of cases with id, name, short_name, status, court.
        """
        context.info(f"Listing cases{' with status=' + status_filter if status_filter else ''}")
        result = db.get_all_cases(status_filter)
        context.info(f"Found {result['total']} cases")
        return {"cases": result["cases"], "total": result["total"], "filter": status_filter}

    @mcp.tool()
    def get_case(context: Context, case_id: Optional[int] = None, case_name: Optional[str] = None) -> dict:
        """
        Get full details for a specific case by ID or name.

        Args:
            case_id: The numeric ID of the case
            case_name: The name of the case (e.g., "Martinez v. City of Los Angeles")

        Returns complete case information including persons (clients, defendants, contacts),
        case numbers, activities, events, tasks, and notes.
        """
        if case_id:
            context.info(f"Fetching case by ID: {case_id}")
            case = db.get_case_by_id(case_id)
        elif case_name:
            context.info(f"Fetching case by name: {case_name}")
            case = db.get_case_by_name(case_name)
        else:
            return validation_error("Provide either case_id or case_name")

        if not case:
            context.info("Case not found")
            available = db.get_all_case_names()
            result = not_found_error("Case")
            result["available_cases"] = available
            return result

        context.info(f"Retrieved case: {case.get('case_name', 'Unknown')}")
        return case

    @mcp.tool()
    def create_case(
        context: Context,
        case_name: str,
        status: str = "Signing Up",
        court_id: Optional[int] = None,
        print_code: Optional[str] = None,
        case_summary: Optional[str] = None,
        result: Optional[str] = None,
        date_of_injury: Optional[str] = None,
        case_numbers: Optional[list] = None,
        short_name: Optional[str] = None
    ) -> dict:
        """
        Create a new case.

        After creating a case, use assign_person_to_case to add clients, defendants,
        opposing counsel, judges, experts, etc.

        Args:
            case_name: Name of the case (e.g., "Jones v. LAPD")
            status: Initial status (default: "Signing Up")
            court_id: ID of the jurisdiction/court (use list_jurisdictions to see options)
            print_code: Short code for printing/filing
            case_summary: Brief description of the case
            result: Case outcome/result (e.g., "Settled", "Verdict for plaintiff")
            date_of_injury: Date of injury (YYYY-MM-DD format)
            case_numbers: List of case numbers
                          Format: [{"number": "24STCV12345", "label": "State", "primary": true}]
            short_name: Short display name (defaults to first word of case_name)

        Returns the created case.

        Example:
            create_case(
                case_name="Martinez v. City of LA",
                status="Signing Up",
                court_id=1,
                case_numbers=[{"number": "24STCV12345", "label": "State", "primary": true}]
            )
        """
        context.info(f"Creating new case: {case_name}")
        try:
            db.validate_case_status(status)
            if date_of_injury:
                db.validate_date_format(date_of_injury, "date_of_injury")
        except ValidationError as e:
            return validation_error(str(e))

        case = db.create_case(
            case_name, status, court_id, print_code, case_summary, result,
            date_of_injury, case_numbers, short_name
        )
        context.info(f"Case created with ID {case.get('id')}")
        return {"success": True, "message": f"Case '{case_name}' created", "case": case}

    @mcp.tool()
    def update_case(
        context: Context,
        case_id: int,
        case_name: Optional[str] = None,
        short_name: Optional[str] = None,
        status: Optional[str] = None,
        court_id: Optional[int] = None,
        print_code: Optional[str] = None,
        case_summary: Optional[str] = None,
        result: Optional[str] = None,
        date_of_injury: Optional[str] = None,
        case_numbers: Optional[list] = None
    ) -> dict:
        """
        Update case fields.

        Args:
            case_id: ID of the case to update
            case_name: New case name
            short_name: New short display name
            status: New status
            court_id: New court/jurisdiction ID
            print_code: New print code
            case_summary: New summary
            result: Case outcome/result
            date_of_injury: Date of injury (YYYY-MM-DD)
            case_numbers: List of case numbers (replaces entire list).
                          Format: [{"number": "24STCV12345", "label": "State", "primary": true}]

        Returns updated case info.
        """
        context.info(f"Updating case {case_id}")
        try:
            if status:
                db.validate_case_status(status)
            if date_of_injury:
                db.validate_date_format(date_of_injury, "date_of_injury")
        except ValidationError as e:
            return validation_error(str(e))

        updated = db.update_case(
            case_id, case_name=case_name, short_name=short_name, status=status,
            court_id=court_id, print_code=print_code, case_summary=case_summary,
            result=result, date_of_injury=date_of_injury,
            case_numbers=case_numbers
        )
        if not updated:
            return not_found_error("Case or no updates provided")
        context.info(f"Case {case_id} updated successfully")
        return {"success": True, "case": updated}

    @mcp.tool()
    def delete_case(context: Context, case_id: int) -> dict:
        """
        Delete a case and all related data (persons, events, tasks, notes, etc. are CASCADE deleted).

        Args:
            case_id: ID of the case to delete

        Returns confirmation.
        """
        context.info(f"Deleting case {case_id} and all related data")
        if db.delete_case(case_id):
            context.info(f"Case {case_id} deleted successfully")
            return {"success": True, "message": "Case and all related data deleted"}
        return not_found_error("Case")

    @mcp.tool()
    def search_cases(
        context: Context,
        query: Optional[str] = None,
        case_number: Optional[str] = None,
        person_name: Optional[str] = None,
        status: Optional[str] = None,
        court_id: Optional[int] = None
    ) -> dict:
        """
        Search for cases with multiple filter options.

        All provided filters are combined with AND logic (case must match all filters).

        Args:
            query: Free text search on case name and summary (e.g., "Martinez", "City of LA")
            case_number: Search by case number (e.g., "24STCV", "12345")
            person_name: Filter by any person's name (client, defendant, expert, etc.)
            status: Filter by exact status (e.g., "Discovery", "Pre-trial")
            court_id: Filter by jurisdiction/court ID

        At least one search parameter must be provided.

        Returns matching cases with context:
        [{id, case_name, short_name, status, case_summary, court, case_numbers}]

        Examples:
            - search_cases(query="Martinez") - find cases with "Martinez" in the name/summary
            - search_cases(person_name="LAPD") - find all cases involving LAPD
            - search_cases(status="Discovery") - find all cases in Discovery phase
            - search_cases(person_name="City", status="Pre-trial") - cases with "City" in Pre-trial
        """
        if not any([query, case_number, person_name, status, court_id]):
            return validation_error("Provide at least one search parameter")

        filters = [f for f in [query, case_number, person_name, status, court_id] if f]
        context.info(f"Searching cases with {len(filters)} filter(s)")
        cases = db.search_cases(query, case_number, person_name, status, court_id)
        context.info(f"Found {len(cases)} matching cases")
        return {"cases": cases, "total": len(cases)}
