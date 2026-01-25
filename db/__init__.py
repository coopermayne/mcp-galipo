"""
Database module for PostgreSQL connection and operations.

Uses DATABASE_URL environment variable (provided by Coolify).
Implements normalized schema for personal injury litigation practice.

This module re-exports all functions from the domain-specific submodules
for backwards compatibility.
"""

# Validation constants and functions
from .validation import (
    ValidationError,
    CASE_STATUSES,
    TASK_STATUSES,
    ACTIVITY_TYPES,
    DEFAULT_PERSON_TYPES,
    PERSON_SIDES,
    DEFAULT_EXPERTISE_TYPES,
    DEFAULT_JURISDICTIONS,
    JUDGE_ROLES,
    validate_case_status,
    validate_task_status,
    validate_urgency,
    validate_date_format,
    validate_time_format,
    validate_person_type,
    validate_person_side,
    validate_case_person_role,
)

# Connection and database management
from .connection import (
    DATABASE_URL,
    _NOT_PROVIDED,
    serialize_value,
    serialize_row,
    serialize_rows,
    get_connection,
    get_cursor,
    drop_all_tables,
    migrate_db,
    init_db,
    seed_jurisdictions,
    seed_expertise_types,
    seed_person_types,
    seed_db,
)

# Jurisdiction operations
from .jurisdictions import (
    get_jurisdictions,
    get_jurisdiction_by_id,
    get_jurisdiction_by_name,
    create_jurisdiction,
    update_jurisdiction,
    delete_jurisdiction,
)

# Case operations
from .cases import (
    get_all_cases,
    get_case_by_id,
    get_case_by_name,
    get_all_case_names,
    create_case,
    update_case,
    delete_case,
    search_cases,
    get_dashboard_stats,
)

# Person operations
from .persons import (
    create_person,
    get_person_by_id,
    update_person,
    search_persons,
    archive_person,
    delete_person,
    assign_person_to_case,
    update_case_assignment,
    remove_person_from_case,
    get_case_persons,
)

# Task operations
from .tasks import (
    add_task,
    get_tasks,
    update_task,
    update_task_full,
    delete_task,
    bulk_update_tasks,
    bulk_update_tasks_for_case,
    search_tasks,
    reorder_task,
)

# Event operations
from .events import (
    add_event,
    get_upcoming_events,
    get_events,
    update_event,
    update_event_full,
    delete_event,
    search_events,
    get_calendar,
)

# Activity operations
from .activities import (
    add_activity,
    get_all_activities,
    get_activities,
    update_activity,
    delete_activity,
)

# Note operations
from .notes import (
    add_note,
    update_note,
    delete_note,
    get_notes,
)

# Type operations (expertise types and person types)
from .types import (
    get_expertise_types,
    create_expertise_type,
    get_expertise_type_by_id,
    update_expertise_type,
    delete_expertise_type,
    get_person_types,
    create_person_type,
    get_person_type_by_id,
    update_person_type,
    delete_person_type,
)

# Proceeding operations
from .proceedings import (
    add_proceeding,
    get_proceedings,
    get_proceeding_by_id,
    update_proceeding,
    delete_proceeding,
    # Proceeding judges
    add_judge_to_proceeding,
    remove_judge_from_proceeding,
    get_judges,
    update_proceeding_judge,
)

# Define __all__ for explicit exports
__all__ = [
    # Validation
    "ValidationError",
    "CASE_STATUSES",
    "TASK_STATUSES",
    "ACTIVITY_TYPES",
    "DEFAULT_PERSON_TYPES",
    "PERSON_SIDES",
    "DEFAULT_EXPERTISE_TYPES",
    "DEFAULT_JURISDICTIONS",
    "JUDGE_ROLES",
    "validate_case_status",
    "validate_task_status",
    "validate_urgency",
    "validate_date_format",
    "validate_time_format",
    "validate_person_type",
    "validate_person_side",
    "validate_case_person_role",
    # Connection
    "DATABASE_URL",
    "_NOT_PROVIDED",
    "serialize_value",
    "serialize_row",
    "serialize_rows",
    "get_connection",
    "get_cursor",
    "drop_all_tables",
    "migrate_db",
    "init_db",
    "seed_jurisdictions",
    "seed_expertise_types",
    "seed_person_types",
    "seed_db",
    # Jurisdictions
    "get_jurisdictions",
    "get_jurisdiction_by_id",
    "get_jurisdiction_by_name",
    "create_jurisdiction",
    "update_jurisdiction",
    "delete_jurisdiction",
    # Cases
    "get_all_cases",
    "get_case_by_id",
    "get_case_by_name",
    "get_all_case_names",
    "create_case",
    "update_case",
    "delete_case",
    "search_cases",
    "get_dashboard_stats",
    # Persons
    "create_person",
    "get_person_by_id",
    "update_person",
    "search_persons",
    "archive_person",
    "delete_person",
    "assign_person_to_case",
    "update_case_assignment",
    "remove_person_from_case",
    "get_case_persons",
    # Tasks
    "add_task",
    "get_tasks",
    "update_task",
    "update_task_full",
    "delete_task",
    "bulk_update_tasks",
    "bulk_update_tasks_for_case",
    "search_tasks",
    "reorder_task",
    # Events
    "add_event",
    "get_upcoming_events",
    "get_events",
    "update_event",
    "update_event_full",
    "delete_event",
    "search_events",
    "get_calendar",
    # Activities
    "add_activity",
    "get_all_activities",
    "get_activities",
    "update_activity",
    "delete_activity",
    # Notes
    "add_note",
    "update_note",
    "delete_note",
    "get_notes",
    # Types
    "get_expertise_types",
    "create_expertise_type",
    "get_expertise_type_by_id",
    "update_expertise_type",
    "delete_expertise_type",
    "get_person_types",
    "create_person_type",
    "get_person_type_by_id",
    "update_person_type",
    "delete_person_type",
    # Proceedings
    "add_proceeding",
    "get_proceedings",
    "get_proceeding_by_id",
    "update_proceeding",
    "delete_proceeding",
    # Proceeding judges
    "add_judge_to_proceeding",
    "remove_judge_from_proceeding",
    "get_judges",
    "update_proceeding_judge",
]
