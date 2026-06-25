"""worklog: store time as decimal hours instead of integer minutes

Revision ID: a1f4c9d27e83
Revises: 4cd38a4981c3
Create Date: 2026-06-24

Converts worklog_entries.minutes (Integer) -> hours (Numeric(6,2)), carrying
existing data across as minutes / 60 rounded to 2 decimals.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a1f4c9d27e83"
down_revision = "4cd38a4981c3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "worklog_entries",
        sa.Column("hours", sa.Numeric(6, 2), nullable=True),
    )
    op.execute("UPDATE worklog_entries SET hours = ROUND(minutes / 60.0, 2)")
    op.alter_column("worklog_entries", "hours", nullable=False)
    op.drop_column("worklog_entries", "minutes")


def downgrade() -> None:
    op.add_column(
        "worklog_entries",
        sa.Column("minutes", sa.Integer(), nullable=True),
    )
    op.execute("UPDATE worklog_entries SET minutes = ROUND(hours * 60)")
    op.alter_column("worklog_entries", "minutes", nullable=False)
    op.drop_column("worklog_entries", "hours")
