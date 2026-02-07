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
    ROLE_CATEGORIES,
    DEFAULT_EXPERTISE_TYPES,
    DEFAULT_JURISDICTIONS,
    DEFAULT_ROLES,
    validate_case_status,
    validate_task_status,
    validate_urgency,
    validate_date_format,
    validate_time_format,
    validate_role_category,
)

# Connection and database management
from .connection import (
    DATABASE_URL,
    _NOT_PROVIDED,
    drop_all_tables,
    init_db,
    seed_admin_user,
    seed_jurisdictions,
    seed_expertise_types,
    seed_roles,
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
    get_case_summary,
    get_all_case_names,
    create_case,
    update_case,
    delete_case,
    search_cases,
    get_dashboard_stats,
    # Staff assignments
    get_case_users,
    assign_attorney_to_case,
    remove_attorney_from_case,
    assign_paralegal_to_case,
    remove_paralegal_from_case,
    get_cases_for_user,
)

# Role operations (replaces person_types)
from .roles import (
    get_roles,
    get_role_by_id,
    get_role_by_name,
    create_role,
    update_role,
    delete_role,
    count_persons_by_role,
    get_roles_with_counts,
)

# Person operations
from .persons import (
    create_person,
    get_person_by_id,
    update_person,
    search_persons,
    delete_person,
    archive_person,
    assign_person_to_case,
    update_case_assignment,
    change_person_role_on_case,
    remove_person_from_case,
    get_case_persons,
    find_duplicate_persons,
    preview_merge,
    merge_persons,
)

# Judge operations (standalone judge entity)
from .judges import (
    get_judges,
    get_judge_by_id,
    search_judges,
    create_judge,
    update_judge,
    delete_judge,
    add_judge_to_proceeding,
    remove_judge_from_proceeding,
    get_proceeding_judges,
    update_proceeding_judge,
)

# Task operations
from .tasks import (
    add_task,
    get_tasks,
    get_task_detail,
    update_task,
    update_task_full,
    delete_task,
    bulk_update_tasks,
    bulk_update_tasks_for_case,
    reschedule_overdue_tasks,
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
    get_tasks_for_event,
    # Attendees
    get_event_attendees,
    add_event_attendee,
    remove_event_attendee,
    get_event_by_id,
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

# Type operations (expertise types only - person types replaced by roles)
from .types import (
    get_expertise_types,
    create_expertise_type,
    get_expertise_type_by_id,
    update_expertise_type,
    delete_expertise_type,
)

# Proceeding operations
from .proceedings import (
    add_proceeding,
    get_proceedings,
    get_proceeding_by_id,
    update_proceeding,
    delete_proceeding,
    # CourtListener integration
    get_proceeding_by_courtlistener_docket_id,
    get_proceeding_by_pacer_case_id,
    find_proceeding_for_webhook,
)

# Webhook operations
from .webhooks import (
    create_webhook_log,
    get_webhook_log_by_id,
    get_webhook_log_by_idempotency_key,
    get_webhook_logs,
    get_pending_webhook_logs,
    update_webhook_log,
    mark_webhook_processing,
    mark_webhook_completed,
    mark_webhook_failed,
    idempotency_key_exists,
    delete_webhook_log,
)

# User operations
from .users import (
    hash_password,
    verify_password,
    get_user_by_id,
    get_user_by_email,
    get_all_users,
    get_attorneys,
    create_user,
    update_user,
    update_password,
    delete_user,
    authenticate_user,
    get_attorneys_for_paralegal,
)

# Dev user seeding (safe - only runs in verified dev environments)
from .dev_users import (
    seed_dev_users,
    is_dev_environment,
    DEV_USERS,
    DEV_PASSWORD,
)

# Bulk import
from .import_case import (
    import_case,
)

# Define __all__ for explicit exports
__all__ = [
    # Validation
    "ValidationError",
    "CASE_STATUSES",
    "TASK_STATUSES",
    "ACTIVITY_TYPES",
    "ROLE_CATEGORIES",
    "DEFAULT_EXPERTISE_TYPES",
    "DEFAULT_JURISDICTIONS",
    "DEFAULT_ROLES",
    "validate_case_status",
    "validate_task_status",
    "validate_urgency",
    "validate_date_format",
    "validate_time_format",
    "validate_role_category",
    # Connection
    "DATABASE_URL",
    "_NOT_PROVIDED",
    "drop_all_tables",
    "init_db",
    "seed_admin_user",
    "seed_jurisdictions",
    "seed_expertise_types",
    "seed_roles",
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
    "get_case_summary",
    "get_all_case_names",
    "create_case",
    "update_case",
    "delete_case",
    "search_cases",
    "get_dashboard_stats",
    # Case staff assignments
    "get_case_users",
    "assign_attorney_to_case",
    "remove_attorney_from_case",
    "assign_paralegal_to_case",
    "remove_paralegal_from_case",
    "get_cases_for_user",
    # Roles
    "get_roles",
    "get_role_by_id",
    "get_role_by_name",
    "create_role",
    "update_role",
    "delete_role",
    "count_persons_by_role",
    "get_roles_with_counts",
    # Persons
    "create_person",
    "get_person_by_id",
    "update_person",
    "search_persons",
    "delete_person",
    "archive_person",
    "assign_person_to_case",
    "update_case_assignment",
    "change_person_role_on_case",
    "remove_person_from_case",
    "get_case_persons",
    "find_duplicate_persons",
    "preview_merge",
    "merge_persons",
    # Judges
    "get_judges",
    "get_judge_by_id",
    "search_judges",
    "create_judge",
    "update_judge",
    "delete_judge",
    "add_judge_to_proceeding",
    "remove_judge_from_proceeding",
    "get_proceeding_judges",
    "update_proceeding_judge",
    # Tasks
    "add_task",
    "get_tasks",
    "get_task_detail",
    "update_task",
    "update_task_full",
    "delete_task",
    "bulk_update_tasks",
    "bulk_update_tasks_for_case",
    "reschedule_overdue_tasks",
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
    "get_tasks_for_event",
    # Event attendees
    "get_event_attendees",
    "add_event_attendee",
    "remove_event_attendee",
    "get_event_by_id",
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
    # Types (expertise types only)
    "get_expertise_types",
    "create_expertise_type",
    "get_expertise_type_by_id",
    "update_expertise_type",
    "delete_expertise_type",
    # Proceedings
    "add_proceeding",
    "get_proceedings",
    "get_proceeding_by_id",
    "update_proceeding",
    "delete_proceeding",
    # CourtListener integration
    "get_proceeding_by_courtlistener_docket_id",
    "get_proceeding_by_pacer_case_id",
    "find_proceeding_for_webhook",
    # Webhooks
    "create_webhook_log",
    "get_webhook_log_by_id",
    "get_webhook_log_by_idempotency_key",
    "get_webhook_logs",
    "get_pending_webhook_logs",
    "update_webhook_log",
    "mark_webhook_processing",
    "mark_webhook_completed",
    "mark_webhook_failed",
    "idempotency_key_exists",
    "delete_webhook_log",
    # Users
    "hash_password",
    "verify_password",
    "get_user_by_id",
    "get_user_by_email",
    "get_all_users",
    "get_attorneys",
    "create_user",
    "update_user",
    "update_password",
    "delete_user",
    "authenticate_user",
    "get_attorneys_for_paralegal",
    # Dev user seeding
    "seed_dev_users",
    "is_dev_environment",
    "DEV_USERS",
    "DEV_PASSWORD",
    # Bulk import
    "import_case",
]
