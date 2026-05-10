"""convert all datetime to timestamptz

Revision ID: 3b0250bc9dd1
Revises: 2afbe506265f
Create Date: 2026-05-10 13:20:19.153280

"""
from typing import Sequence, Union

from alembic import op

revision: str = '3b0250bc9dd1'
down_revision: Union[str, Sequence[str], None] = '2afbe506265f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ALL_COLUMNS = [
    ("auth_sessions", "created_at"),
    ("auth_sessions", "expires_at"),
    ("case_comments", "created_at"),
    ("case_comments", "updated_at"),
    ("case_comment_reads", "last_read_at"),
    ("case_counsel_fees", "created_at"),
    ("case_financials", "created_at"),
    ("case_financials", "updated_at"),
    ("cases", "created_at"),
    ("cases", "updated_at"),
    ("events", "created_at"),
    ("expertise_types", "created_at"),
    ("intake_comment_reads", "last_read_at"),
    ("intake_comments", "created_at"),
    ("intake_comments", "updated_at"),
    ("intakes", "submitted_on"),
    ("intakes", "created_at"),
    ("intakes", "updated_at"),
    ("invoices", "created_at"),
    ("invoices", "updated_at"),
    ("judges", "created_at"),
    ("judges", "updated_at"),
    ("jurisdictions", "created_at"),
    ("notes", "created_at"),
    ("notes", "updated_at"),
    ("objections", "created_at"),
    ("objections", "updated_at"),
    ("page_views", "viewed_at"),
    ("payees", "created_at"),
    ("payees", "updated_at"),
    ("person_roles", "created_at"),
    ("persons", "created_at"),
    ("persons", "updated_at"),
    ("proceeding_judges", "created_at"),
    ("proceedings", "created_at"),
    ("proceedings", "updated_at"),
    ("roles", "created_at"),
    ("sms_conversation_reads", "last_read_at"),
    ("sms_conversations", "created_at"),
    ("sms_conversations", "last_message_at"),
    ("sms_messages", "created_at"),
    ("sms_message_media", "created_at"),
    ("tasks", "created_at"),
    ("tasks", "updated_at"),
    ("users", "created_at"),
    ("users", "updated_at"),
    ("users", "last_active_at"),
    ("webhook_logs", "created_at"),
    ("webhook_logs", "processed_at"),
]


def upgrade() -> None:
    # 1. Convert all timestamp columns to timestamptz.
    #    Columns already timestamptz are unchanged (safe no-op).
    #    Columns still timestamp get +00 appended (correct, since server is UTC).
    for table, col in ALL_COLUMNS:
        op.execute(
            f"ALTER TABLE {table} ALTER COLUMN {col} "
            f"TYPE timestamptz USING {col} AT TIME ZONE 'UTC'"
        )

    # 2. Fix intakes.submitted_on — values are Pacific time wrongly stored as UTC.
    #    Reinterpret: strip the (wrong) UTC tag, then re-tag as Pacific → auto-converts to real UTC.
    #    Handles DST transitions automatically (PDT=-7, PST=-8).
    op.execute(
        "UPDATE intakes "
        "SET submitted_on = (submitted_on AT TIME ZONE 'UTC') AT TIME ZONE 'America/Los_Angeles' "
        "WHERE submitted_on IS NOT NULL"
    )

    # 3. Clear invoices and payees (user-approved: minimal production data, fresh start).
    op.execute("DELETE FROM invoices")
    op.execute("DELETE FROM payees")


def downgrade() -> None:
    for table, col in reversed(ALL_COLUMNS):
        op.execute(
            f"ALTER TABLE {table} ALTER COLUMN {col} "
            f"TYPE timestamp USING {col} AT TIME ZONE 'UTC'"
        )
