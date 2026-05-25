#!/usr/bin/env python3
"""
MCP Server in stdio mode for Claude Desktop.

This runs the same MCP server but using stdio transport instead of SSE,
which is what Claude Desktop expects.
"""

import os
import sys

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables from .env
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'))

from fastmcp import FastMCP
import db
from tools import register_tools

MCP_INSTRUCTIONS = """Legal Case Management System for personal injury law firms.

IMPORTANT: Call get_current_time at the start of any session to know the current date/time in Pacific Time.

TOOLS OVERVIEW:
- search(entity, ...) — universal search across cases, persons, events, tasks
- get_details(entity, id) — full details for any entity by ID
- manage_case(action, ...) — create/update/delete cases
- manage_person(action, ...) — create/update/delete persons (contacts)
- manage_case_role(action, ...) — assign/update/change/remove person roles on cases
- manage_event(action, ...) — create/update/delete calendar events
- manage_task(action, ...) — create/update/delete/bulk_update tasks
- manage_note(action, ...) — create/update/delete case notes
- manage_proceeding(action, ...) — create/update/delete proceedings + add/remove judges
- list_staff() — list all active staff members (for task assignment)
- import_case(data) — bulk import a complete case with all related data

VALID VALUES (these are enforced — invalid values return an error with the valid options):
- Case status: "Signing Up", "Pre-Claim", "Pre-Filing", "Pleadings", "Discovery", "Expert Discovery", "Pre-trial", "Trial", "Post-Trial", "Appeal", "Settl. Pend.", "Stayed", "Closed"
- Task status: "Pending", "Active", "Done", "Partially Done", "Blocked", "Awaiting Atty Review"
- Urgency: "Low", "Medium", "High", "Urgent"
- Judge roles: "Judge", "Magistrate Judge", "Presiding", "Panel"

ROLES SYSTEM (unified person-role management):
Persons are assigned to cases via manage_case_role with role names (accepts both snake_case and space-separated):
- client: plaintiff, contact, guardian_ad_litem, decedent
- counsel: co_counsel, referring_attorney, opposing_counsel, criminal_defense_attorney, prosecutor, public_defender
- defendant: municipality_defendant, individual_defendant
- expert: plaintiff_expert, defense_expert
- mediator: mediator
- other: lien_holder, witness, claims_adjuster, special_needs_consultant

JUDGES (standalone entities):
Judges are NOT persons — they are assigned to proceedings, not cases.
- Use manage_proceeding(action="add_judge", proceeding_id=N, judge_id=M, judge_role="Judge")

PROCEEDINGS WORKFLOW:
1. Create proceeding: manage_proceeding(action="create", case_id=N, case_number="24STCV12345", jurisdiction_id=M)
2. Add judges: manage_proceeding(action="add_judge", proceeding_id=N, judge_id=M, judge_role="Judge")

DATA ENTRY GUIDELINES:
- Skip vacated, canceled, or stricken events/deadlines — do not add these
- Use the calculation_note field for deadline sources (e.g., "Dkt. 47, LR 7-3")
- For depositions, include the deponent name in the event description"""


def main():
    # Initialize database (Alembic handles migrations)
    db.init_db()
    db.seed_db()

    # Create MCP server
    mcp = FastMCP("Legal Case Management", instructions=MCP_INSTRUCTIONS)

    # Register tools
    register_tools(mcp)

    # Run in stdio mode for Claude Desktop
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
