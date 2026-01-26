"""
MCP Tools for Legal Case Management

This package contains domain-specific MCP tool modules for querying and managing legal cases.
"""

from tools.jurisdictions import register_jurisdiction_tools
from tools.cases import register_case_tools
from tools.persons import register_person_tools
from tools.tasks import register_task_tools
from tools.events import register_event_tools
from tools.activities import register_activity_tools
from tools.notes import register_note_tools
from tools.types import register_type_tools
from tools.proceedings import register_proceeding_tools
from tools.search import register_search_tools
from tools.help import register_help_tools
from tools.time import register_time_tools

# Re-export utility functions for backwards compatibility
from tools.utils import error_response, validation_error, not_found_error


def register_tools(mcp):
    """Register all MCP tools on the given FastMCP instance.

    This function calls all domain-specific registration functions to set up
    the complete set of MCP tools for the legal case management system.

    Args:
        mcp: A FastMCP instance to register tools on
    """
    # Time tool first (for current date/time awareness)
    register_time_tools(mcp)

    # Core domain tools
    register_jurisdiction_tools(mcp)
    register_case_tools(mcp)
    register_person_tools(mcp)
    register_task_tools(mcp)
    register_event_tools(mcp)
    register_activity_tools(mcp)
    register_note_tools(mcp)
    register_type_tools(mcp)
    register_proceeding_tools(mcp)

    # Unified search (replaces individual search_* tools)
    register_search_tools(mcp)

    # Help system (on-demand detailed docs)
    register_help_tools(mcp)


__all__ = [
    # Main registration function
    'register_tools',

    # Domain-specific registration functions
    'register_time_tools',
    'register_jurisdiction_tools',
    'register_case_tools',
    'register_person_tools',
    'register_task_tools',
    'register_event_tools',
    'register_activity_tools',
    'register_note_tools',
    'register_type_tools',
    'register_proceeding_tools',
    'register_search_tools',
    'register_help_tools',

    # Utility functions
    'error_response',
    'validation_error',
    'not_found_error',
]
