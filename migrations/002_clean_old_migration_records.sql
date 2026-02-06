-- Migration: Remove stale schema_migrations entries
-- Description: The 21 legacy migration files were folded into init_db() and deleted.
-- Their records in schema_migrations are now orphaned. Clean them up.

DELETE FROM schema_migrations WHERE filename NOT LIKE '0%' OR filename IN (
    '001_remove_court_id_from_cases.sql',
    '002_proceeding_judges.sql',
    '003_rename_proceeding_judges_to_judges.sql',
    '004_webhook_logs.sql',
    '005_courtlistener_docket_id.sql',
    '006_users.sql',
    '007_ensure_admin_user.sql',
    '008_completion_date_to_timestamp.sql',
    '009_case_color.sql',
    '010_user_assignments.sql',
    '011_drop_case_numbers_column.sql',
    '012_unified_roles_schema.sql',
    '013_reseed_roles.sql',
    '014_fix_persons_sequence.sql',
    '015_cleanup_and_constraints.sql',
    '016_rebuild_persons_judges_proceedings.sql',
    '017_print_code_to_integer.sql',
    '018_drop_docket_columns.sql',
    '019_urgency_to_string.sql',
    '020_jurisdiction_long_name.sql',
    '021_proceedings_primary_constraint_and_notes_starred.sql'
);
