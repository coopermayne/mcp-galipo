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
    get_case_status_counts,
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
    check_person_duplicates,
    fuzzy_search_persons_db,
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

# Objections
from .objections import (
    get_objections,
    get_objection_by_id,
    create_objection,
    update_objection,
    delete_objection,
    reorder_objections,
)

# Intakes
from .intakes import (
    get_intakes,
    get_intake_by_id,
    get_intake_status_counts,
    set_ai_analyzing,
    save_ai_analysis,
    update_intake,
    bulk_archive_by_status,
    delete_intake,
    create_intake,
    sync_from_sheet,
)

# Case comments
from .case_comments import (
    get_case_comments,
    add_case_comment,
    get_last_read_at as get_case_last_read_at,
    mark_case_read,
    get_unread_counts as get_case_unread_counts,
)

# Intake comments
from .intake_comments import (
    get_intake_comments,
    add_intake_comment,
    get_last_read_at,
    mark_intake_read,
    get_comment_flags,
    get_unread_counts,
    get_recent_activity,
)

# SMS
from .sms import (
    list_conversations as list_sms_conversations,
    get_conversation as get_sms_conversation,
    get_messages as get_sms_messages,
    find_or_create_conversation as find_or_create_sms_conversation,
    create_message as create_sms_message,
    update_conversation_label as update_sms_conversation_label,
    archive_conversation as archive_sms_conversation,
    delete_conversation as delete_sms_conversation,
    create_message_media as create_sms_message_media,
    get_media_by_id as get_sms_media_by_id,
    mark_conversation_read as mark_sms_conversation_read,
    get_unread_counts as get_sms_unread_counts,
    link_conversation,
    get_conversations_by_person,
)

# Financials
from .financials import (
    get_all_financials,
    get_financial_by_id,
    get_financial_by_case,
    create_financial,
    update_financial,
    delete_financial,
    get_resolution_type_counts,
    create_counsel_fee,
    update_counsel_fee,
    delete_counsel_fee,
)

# Auth sessions
from .auth_sessions import (
    create_auth_session,
    validate_auth_session,
    extend_auth_session,
    delete_auth_session,
    delete_user_sessions,
    cleanup_expired_sessions,
)

# Activity tracking
from .activity import (
    touch_last_active,
    record_page_view,
    get_activity_summary,
    get_page_views_paginated,
    get_user_page_views,
)

# Payees
from .payees import (
    list_payees,
    get_payee,
    create_payee,
    update_payee,
    delete_payee,
    search_payees,
)

# Invoices
from .invoices import (
    list_invoices,
    get_invoice,
    create_invoice,
    update_invoice,
    mark_invoice_paid,
    mark_invoice_unpaid,
    delete_invoice,
    get_invoice_stats,
    get_cost_summary,
    calculate_equalization,
    get_cost_sharing,
    set_cost_sharing,
    remove_cost_sharing,
    get_advance_stats,
)

# Liens
from .liens import (
    list_liens,
    get_lien,
    create_lien,
    update_lien,
    delete_lien,
    get_lien_stats,
)

# Polymorphic comments
from .comments import (
    get_comments,
    add_comment,
    get_last_read_at as get_comment_last_read_at,
    mark_read as mark_comment_read,
    get_unread_counts as get_comment_unread_counts,
)

# Trial calendar
from .trial_calendar import (
    get_trial_calendar,
)

# Bulk import
from .import_case import (
    import_case,
)

# ORM event listeners (import registers them at startup)
from . import listeners  # noqa: F401

# Define __all__ for explicit exports
__all__ = [
    # Validation
    "ValidationError",
    "CASE_STATUSES",
    "TASK_STATUSES",
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
    "get_case_status_counts",
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
    "check_person_duplicates",
    "fuzzy_search_persons_db",
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
    # Objections
    "get_objections",
    "get_objection_by_id",
    "create_objection",
    "update_objection",
    "delete_objection",
    "reorder_objections",
    # Intakes
    "get_intakes",
    "get_intake_by_id",
    "get_intake_status_counts",
    "set_ai_analyzing",
    "save_ai_analysis",
    "update_intake",
    "delete_intake",
    "create_intake",
    "sync_from_sheet",
    # Case comments
    "get_case_comments",
    "add_case_comment",
    "get_case_last_read_at",
    "mark_case_read",
    "get_case_unread_counts",
    # Intake comments
    "get_intake_comments",
    "add_intake_comment",
    "get_last_read_at",
    "mark_intake_read",
    "get_unread_counts",
    "get_recent_activity",
    # SMS
    "list_sms_conversations",
    "get_sms_conversation",
    "get_sms_messages",
    "find_or_create_sms_conversation",
    "create_sms_message",
    "update_sms_conversation_label",
    "archive_sms_conversation",
    "delete_sms_conversation",
    "create_sms_message_media",
    "get_sms_media_by_id",
    "mark_sms_conversation_read",
    "get_sms_unread_counts",
    # Financials
    "get_all_financials",
    "get_financial_by_id",
    "get_financial_by_case",
    "create_financial",
    "update_financial",
    "delete_financial",
    "get_resolution_type_counts",
    "create_counsel_fee",
    "update_counsel_fee",
    "delete_counsel_fee",
    # Auth sessions
    "create_auth_session",
    "validate_auth_session",
    "extend_auth_session",
    "delete_auth_session",
    "delete_user_sessions",
    "cleanup_expired_sessions",
    # Activity tracking
    "touch_last_active",
    "record_page_view",
    "get_activity_summary",
    "get_page_views_paginated",
    "get_user_page_views",
    # Payees
    "list_payees",
    "get_payee",
    "create_payee",
    "update_payee",
    "delete_payee",
    "search_payees",
    # Invoices
    "list_invoices",
    "get_invoice",
    "create_invoice",
    "update_invoice",
    "mark_invoice_paid",
    "mark_invoice_unpaid",
    "delete_invoice",
    "get_invoice_stats",
    "get_cost_summary",
    "calculate_equalization",
    "get_cost_sharing",
    "set_cost_sharing",
    "remove_cost_sharing",
    "get_advance_stats",
    # Liens
    "list_liens",
    "get_lien",
    "create_lien",
    "update_lien",
    "delete_lien",
    "get_lien_stats",
    # Polymorphic comments
    "get_comments",
    "add_comment",
    "get_comment_last_read_at",
    "mark_comment_read",
    "get_comment_unread_counts",
    # Trial calendar
    "get_trial_calendar",
    # Bulk import
    "import_case",
]
