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
import database as db
from tools import register_tools

MCP_INSTRUCTIONS = """Legal Case Management System for personal injury law firms.

IMPORTANT: Call the get_current_time tool at the start of any session to know the current date and time in Pacific Time (Los Angeles). This is essential for creating events, tasks, or deadlines with correct dates.

This server provides tools to manage cases, tasks, events, contacts, and notes.

PERSON TYPES (for manage_person):
- client: The injured party/plaintiff
- attorney: Lawyers (opposing counsel, co-counsel, etc.)
- judge: Judges and magistrates (assigned to proceedings, not cases directly)
- expert: Expert witnesses (medical, accident reconstruction, economics, etc.)
- mediator: Mediators and arbitrators
- defendant: Named defendants (individuals or entity representatives)
- witness: Fact witnesses
- lien_holder: Medical providers, insurance companies with liens
- interpreter: Court interpreters

CASE ROLES (for assign_person_to_case):
Common roles: Client, Defendant, Opposing Counsel, Co-Counsel, Plaintiff Expert, Defense Expert, Mediator, Witness, Lien Holder
- Use side="plaintiff", "defendant", or "neutral" to indicate which side they're on

JUDGE ROLES (for add_proceeding_judge):
- "Judge" - District/Superior Court Judge
- "Magistrate Judge" - Federal Magistrate Judge
- "Presiding" - Presiding judge on a panel
- "Panel" - Panel member (appellate courts)

JURISDICTIONS & PROCEEDINGS WORKFLOW:
1. Call list_jurisdictions() to see existing courts
2. If the court exists, note its jurisdiction_id
3. If not, call manage_jurisdiction(name="USDC - Central District") to create it
4. Call add_proceeding(case_id, case_number, jurisdiction_id) to link the case to the court
5. Call add_proceeding_judge() to assign judges to the proceeding (not the case)

DATA ENTRY GUIDELINES:
- Skip vacated, canceled, or stricken events/deadlines - do not add these to the system
- When entering deadlines from docket sheets, use the calculation_note field to store the source (e.g., "Dkt. 47, LR 7-3")
- For depositions, include the deponent name in the event description"""


def main():
    # Initialize database
    db.migrate_db()
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
