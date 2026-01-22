"""
MCP Tools for Legal Case Management

DEPRECATED: This module is a backwards-compatibility shim.
The tools have been refactored into the tools/ package with domain-specific modules:
- tools/jurisdictions.py - Jurisdiction tools
- tools/cases.py - Case tools
- tools/persons.py - Person tools
- tools/tasks.py - Task tools
- tools/events.py - Event tools
- tools/activities.py - Activity tools
- tools/notes.py - Note tools
- tools/types.py - Type management tools

For new code, import directly from the tools package:
    from tools import register_tools
"""

# Re-export everything from the tools package for backwards compatibility
from tools import (
    register_tools,
    register_jurisdiction_tools,
    register_case_tools,
    register_person_tools,
    register_task_tools,
    register_event_tools,
    register_activity_tools,
    register_note_tools,
    register_type_tools,
    error_response,
    validation_error,
    not_found_error,
)

__all__ = [
    'register_tools',
    'register_jurisdiction_tools',
    'register_case_tools',
    'register_person_tools',
    'register_task_tools',
    'register_event_tools',
    'register_activity_tools',
    'register_note_tools',
    'register_type_tools',
    'error_response',
    'validation_error',
    'not_found_error',
]
