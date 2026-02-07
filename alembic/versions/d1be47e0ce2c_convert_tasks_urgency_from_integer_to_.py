"""convert tasks urgency from integer to varchar

Revision ID: d1be47e0ce2c
Revises: bb79fda85ea4
Create Date: 2026-02-06 22:16:34.350059

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd1be47e0ce2c'
down_revision: Union[str, Sequence[str], None] = 'bb79fda85ea4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Integer-to-string mapping
URGENCY_MAP = {1: 'Low', 2: 'Medium', 3: 'High', 4: 'Urgent'}
URGENCY_REVERSE = {v: k for k, v in URGENCY_MAP.items()}


def upgrade() -> None:
    """Convert urgency from integer (1-4) to varchar (Low/Medium/High/Urgent)."""
    # 0. Drop existing integer CHECK constraint if present
    op.execute("ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_urgency_check")

    # 1. Add a temporary varchar column
    op.add_column('tasks', sa.Column('urgency_new', sa.String(20)))

    # 2. Map integer values to string labels
    conn = op.get_bind()
    for int_val, str_val in URGENCY_MAP.items():
        conn.execute(
            sa.text("UPDATE tasks SET urgency_new = :str_val WHERE urgency = :int_val"),
            {"str_val": str_val, "int_val": int_val},
        )
    # Handle any NULL values
    conn.execute(sa.text("UPDATE tasks SET urgency_new = 'Medium' WHERE urgency_new IS NULL"))

    # 3. Drop old column, rename new one
    op.drop_column('tasks', 'urgency')
    op.alter_column('tasks', 'urgency_new', new_column_name='urgency',
                    server_default=sa.text("'Medium'::character varying"))

    # 4. Add new string CHECK constraint
    op.create_check_constraint(
        'tasks_urgency_check', 'tasks',
        "urgency IN ('Low', 'Medium', 'High', 'Urgent')"
    )


def downgrade() -> None:
    """Convert urgency back from varchar to integer."""
    op.add_column('tasks', sa.Column('urgency_old', sa.Integer))

    conn = op.get_bind()
    for str_val, int_val in URGENCY_REVERSE.items():
        conn.execute(
            sa.text("UPDATE tasks SET urgency_old = :int_val WHERE urgency = :str_val"),
            {"int_val": int_val, "str_val": str_val},
        )
    conn.execute(sa.text("UPDATE tasks SET urgency_old = 3 WHERE urgency_old IS NULL"))

    op.drop_column('tasks', 'urgency')
    op.alter_column('tasks', 'urgency_old', new_column_name='urgency',
                    server_default=sa.text('3'))
