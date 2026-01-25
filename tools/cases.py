"""
Case MCP Tools

Tools for managing legal cases in the system.
"""

from typing import Optional
from mcp.server.fastmcp import Context
import database as db
from database import ValidationError
from tools.utils import (
    validation_error, not_found_error, CaseStatus,
    invalid_status_error, invalid_date_format_error
)


def register_case_tools(mcp):
    """Register case-related MCP tools."""

    @mcp.tool()
    def list_cases(context: Context, status_filter: Optional[CaseStatus] = None) -> dict:
        """List all cases with optional status filter."""
        context.info(f"Listing cases{' with status=' + status_filter if status_filter else ''}")
        result = db.get_all_cases(status_filter)
        context.info(f"Found {result['total']} cases")
        return {"cases": result["cases"], "total": result["total"], "filter": status_filter}

    @mcp.tool()
    def get_case(context: Context, case_id: Optional[int] = None, case_name: Optional[str] = None) -> dict:
        """Get full details for a specific case by ID or name."""
        if case_id:
            context.info(f"Fetching case by ID: {case_id}")
            case = db.get_case_by_id(case_id)
        elif case_name:
            context.info(f"Fetching case by name: {case_name}")
            case = db.get_case_by_name(case_name)
        else:
            return validation_error(
                "Must provide either case_id or case_name",
                hint="Use case_id for exact lookup, or case_name for name-based search",
                example={"case_id": 5}
            )

        if not case:
            context.info("Case not found")
            available = db.get_all_case_names()
            result = not_found_error("Case")
            result["available_cases"] = available[:10]  # First 10 for context
            if len(available) > 10:
                result["note"] = f"Showing 10 of {len(available)} cases. Use search(entity='cases') for filtered search."
            return result

        context.info(f"Retrieved case: {case.get('case_name', 'Unknown')}")
        return case

    @mcp.tool()
    def get_case_summary(context: Context, case_id: int) -> dict:
        """Get basic case info without full related data (lighter response)."""
        context.info(f"Fetching case summary for ID: {case_id}")
        summary = db.get_case_summary(case_id)

        if not summary:
            return not_found_error("Case")

        context.info(f"Retrieved summary for: {summary.get('case_name', 'Unknown')}")
        return {"success": True, "case": summary}

    @mcp.tool()
    def create_case(
        context: Context,
        case_name: str,
        status: CaseStatus = "Signing Up",
        print_code: Optional[str] = None,
        case_summary: Optional[str] = None,
        result: Optional[str] = None,
        date_of_injury: Optional[str] = None,
        case_numbers: Optional[list] = None,
        short_name: Optional[str] = None
    ) -> dict:
        """Create a new case."""
        context.info(f"Creating new case: {case_name}")
        try:
            db.validate_case_status(status)
        except ValidationError:
            return invalid_status_error(status, "case")

        try:
            if date_of_injury:
                db.validate_date_format(date_of_injury, "date_of_injury")
        except ValidationError:
            return invalid_date_format_error(date_of_injury, "date_of_injury")

        case = db.create_case(
            case_name, status, print_code, case_summary, result,
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
        status: Optional[CaseStatus] = None,
        print_code: Optional[str] = None,
        case_summary: Optional[str] = None,
        result: Optional[str] = None,
        date_of_injury: Optional[str] = None,
        case_numbers: Optional[list] = None
    ) -> dict:
        """Update case fields."""
        context.info(f"Updating case {case_id}")

        if status:
            try:
                db.validate_case_status(status)
            except ValidationError:
                return invalid_status_error(status, "case")

        if date_of_injury:
            try:
                db.validate_date_format(date_of_injury, "date_of_injury")
            except ValidationError:
                return invalid_date_format_error(date_of_injury, "date_of_injury")

        updated = db.update_case(
            case_id, case_name=case_name, short_name=short_name, status=status,
            print_code=print_code, case_summary=case_summary,
            result=result, date_of_injury=date_of_injury,
            case_numbers=case_numbers
        )
        if not updated:
            return not_found_error("Case")
        context.info(f"Case {case_id} updated successfully")
        return {"success": True, "case": updated}

    @mcp.tool()
    def delete_case(context: Context, case_id: int) -> dict:
        """Delete a case and all related data."""
        context.info(f"Deleting case {case_id} and all related data")
        if db.delete_case(case_id):
            context.info(f"Case {case_id} deleted successfully")
            return {"success": True, "message": "Case and all related data deleted"}
        return not_found_error("Case")
