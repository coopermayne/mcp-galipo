"""
MCP Tools for Legal Case Management

Provides 4 SQL-based tools for full database access with rollback capability.
This replaces 41+ individual tools with a compact, flexible interface.
"""

from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Optional
from mcp.server.fastmcp import Context
from uuid import UUID

from db import ValidationError
from db.sql_ops import (
    execute_query,
    execute_mutation,
    rollback_operations,
    get_operation_history,
)

# Schema with semantic hints for the model
SCHEMA = """
## Data Model

CASES - The main entity. A lawsuit/matter being handled by the firm.
  Columns: id, case_name, short_name, status, print_code, case_summary, result, date_of_injury, case_numbers(jsonb)
  Status values: Signing Up|Prospective|Pre-Filing|Pleadings|Discovery|Expert Discovery|Pre-trial|Trial|Post-Trial|Appeal|Settl. Pend.|Stayed|Closed

PROCEEDINGS - Court filings within a case. One case can have multiple proceedings (state court, federal court, appeal, etc).
  Columns: id, case_id, case_number, jurisdiction_id, sort_order, is_primary, notes
  Example: Case "Smith v. Jones" might have proceeding with case_number "2:24-cv-01234" in C.D. Cal.

JURISDICTIONS - Courts where proceedings are filed.
  Columns: id, name, local_rules_link, notes
  Examples: "C.D. Cal.", "Los Angeles Superior", "9th Cir."

JUDGES - Assigned to PROCEEDINGS (not directly to cases). A proceeding can have multiple judges.
  Columns: id, proceeding_id, person_id, role, sort_order
  Roles: Judge, Magistrate Judge, Panel, Presiding
  To add a judge: First ensure the person exists in persons table, then insert into judges with proceeding_id.

PERSONS - People involved in cases: clients, attorneys, experts, defendants, witnesses, etc.
  Columns: id, person_type, name, phones(jsonb), emails(jsonb), address, organization, attributes(jsonb), notes, archived
  person_type examples: client, attorney, judge, expert, mediator, defendant, witness, lien_holder

CASE_PERSONS - Links persons to cases with their role. NOT for judges (judges go on proceedings).
  Columns: id, case_id, person_id, role, side, case_attributes(jsonb), case_notes, is_primary, contact_via_person_id, assigned_date
  Roles: Client, Defendant, Opposing Counsel, Co-Counsel, Plaintiff Expert, Defendant Expert, Mediator, Witness, Lien Holder
  side values: plaintiff|defendant|neutral

TASKS - Internal work items to be done. Tracked separately from calendar events.
  Columns: id, case_id, event_id, due_date, completion_date, description, status, urgency, sort_order
  status values: Pending|Active|Done|Partially Done|Blocked|Awaiting Atty Review
  urgency: 1(Low), 2(Medium), 3(High), 4(Urgent)

EVENTS - Calendar items: hearings, depositions, filing deadlines, meetings. Have date/time/location.
  Columns: id, case_id, date, time, location, description, document_link, calculation_note, starred
  A task can optionally link to an event via event_id (e.g., "Prepare for deposition" task linked to deposition event)

NOTES - Free-form notes on a case.
  Columns: id, case_id, content, created_at, updated_at

ACTIVITIES - Time tracking / activity log entries.
  Columns: id, case_id, date, description, type, minutes
  type values: Meeting|Filing|Research|Drafting|Document Review|Phone Call|Email|Court Appearance|Deposition|Other

## Common Workflows

Adding a court/judge to a case:
1. Find or create jurisdiction: SELECT id FROM jurisdictions WHERE name = 'C.D. Cal.'
2. Create proceeding: INSERT INTO proceedings (case_id, case_number, jurisdiction_id, is_primary) VALUES (...)
3. Find or create judge as person: INSERT INTO persons (person_type, name) VALUES ('judge', 'Hon. Philip Gutierrez')
4. Link judge to proceeding: INSERT INTO judges (proceeding_id, person_id, role) VALUES (..., ..., 'Judge')

Adding a person to a case:
1. Find or create person: INSERT INTO persons (person_type, name, organization) VALUES ('attorney', 'Jane Smith', 'Smith Law')
2. Link to case: INSERT INTO case_persons (case_id, person_id, role, side) VALUES (..., ..., 'Opposing Counsel', 'defendant')
"""


def _get_session_id(context: Context) -> UUID:
    """Extract session_id from context, or generate one if not present."""
    # Try to get session_id from context metadata
    session_id = getattr(context, 'session_id', None)
    if session_id:
        return UUID(session_id) if isinstance(session_id, str) else session_id

    # Fallback: use a default session for MCP server mode
    # In chat mode, session_id will be injected into context
    from uuid import uuid4
    return uuid4()


def register_tools(mcp):
    """Register all MCP tools."""

    # =========================================================================
    # TIME
    # =========================================================================

    @mcp.tool()
    def get_current_time(context: Context) -> dict:
        """Get current date/time in Pacific Time. Call at session start."""
        context.info("Getting current Pacific Time")
        pacific = ZoneInfo("America/Los_Angeles")
        now = datetime.now(pacific)
        return {
            "success": True,
            "date": now.strftime("%A, %B %d, %Y"),
            "time": now.strftime("%I:%M %p"),
            "year": now.year,
            "iso_date": now.strftime("%Y-%m-%d"),
            "timezone": "Pacific Time"
        }

    # =========================================================================
    # QUERY - Read-only SQL access
    # =========================================================================

    @mcp.tool()
    def query(context: Context, sql: str) -> dict:
        f"""Execute read-only SQL query.

{SCHEMA}

Examples:
- SELECT * FROM cases WHERE status = 'Discovery' LIMIT 10
- SELECT c.case_name, COUNT(t.id) as task_count FROM cases c LEFT JOIN tasks t ON t.case_id = c.id GROUP BY c.id
- SELECT p.name, cp.role FROM persons p JOIN case_persons cp ON cp.person_id = p.id WHERE cp.case_id = 5
- SELECT * FROM tasks WHERE case_id = 1 ORDER BY sort_order
- SELECT e.*, c.case_name FROM events e JOIN cases c ON c.id = e.case_id WHERE e.date >= CURRENT_DATE ORDER BY e.date

Args:
    sql: SQL SELECT query to execute (read-only)

Returns:
    rows: List of result rows
    row_count: Number of rows returned
    columns: Column names
"""
        context.info(f"Executing query: {sql[:100]}...")
        try:
            result = execute_query(sql)
            return {"success": True, **result}
        except ValidationError as e:
            return {"success": False, "error": str(e)}
        except Exception as e:
            return {"success": False, "error": f"Query error: {str(e)}"}

    # =========================================================================
    # MUTATE - Insert, update, delete with logging
    # =========================================================================

    @mcp.tool()
    def mutate(
        context: Context,
        table: str,
        action: str,
        data: Optional[dict] = None,
        where: Optional[dict] = None
    ) -> dict:
        """Insert, update, or delete records. Automatically logged for rollback.

Args:
    table: Table name (cases, tasks, events, persons, notes, activities, case_persons, jurisdictions, proceedings, judges, person_types, expertise_types)
    action: 'insert', 'update', or 'delete'
    data: For insert/update - the field values. For delete - ignored.
    where: For update/delete - identifies which record(s). Required for update/delete.

Examples:
- Insert: mutate(table="tasks", action="insert", data={"case_id": 1, "description": "Review docs", "status": "Pending"})
- Update: mutate(table="tasks", action="update", data={"status": "Done"}, where={"id": 42})
- Delete: mutate(table="tasks", action="delete", where={"id": 42})
- Update case status: mutate(table="cases", action="update", data={"status": "Discovery"}, where={"id": 5})

Returns:
    success: True if operation succeeded
    action: The action performed
    record_id: For insert - the new record ID
    records: For update - the updated records
    records_deleted: For delete - count of deleted records
"""
        context.info(f"Mutating {table}: {action}")
        try:
            session_id = _get_session_id(context)
            result = execute_mutation(
                table=table,
                action=action,
                data=data or {},
                where=where,
                session_id=session_id
            )
            return result
        except ValidationError as e:
            return {"success": False, "error": str(e)}
        except Exception as e:
            return {"success": False, "error": f"Mutation error: {str(e)}"}

    # =========================================================================
    # ROLLBACK - Undo recent operations
    # =========================================================================

    @mcp.tool()
    def rollback(context: Context, steps: int = 1) -> dict:
        """Undo the last N operations from this session.

Operations are reversed in order (last first). Returns what was undone.

Args:
    steps: Number of operations to undo (default 1)

Returns:
    success: True if rollback succeeded
    rolled_back: Number of operations rolled back
    operations: List of what was undone
"""
        context.info(f"Rolling back {steps} operations")
        try:
            session_id = _get_session_id(context)
            result = rollback_operations(session_id, steps)
            return result
        except Exception as e:
            return {"success": False, "error": f"Rollback error: {str(e)}"}

    # =========================================================================
    # HISTORY - View recent operations
    # =========================================================================

    @mcp.tool()
    def history(context: Context, limit: int = 10) -> dict:
        """View recent operations from this session.

Shows: sequence, table, action, record_id, timestamp, rolled_back status.

Args:
    limit: Maximum operations to show (default 10)

Returns:
    success: True
    session_id: Current session ID
    operations: List of recent operations
    count: Number of operations returned
"""
        context.info(f"Getting operation history (limit={limit})")
        try:
            session_id = _get_session_id(context)
            result = get_operation_history(session_id, limit)
            return result
        except Exception as e:
            return {"success": False, "error": f"History error: {str(e)}"}
