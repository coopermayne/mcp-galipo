"""unify activities into tasks

Revision ID: b0ccd4398a17
Revises: 0e3bf62c4c1d
Create Date: 2026-02-19 10:28:58.282592

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b0ccd4398a17'
down_revision: Union[str, Sequence[str], None] = '0e3bf62c4c1d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Unify activities into tasks.

    1. Add updated_at to tasks with auto-update trigger
    2. Backfill updated_at on existing tasks
    3. Migrate existing activities -> tasks with status=Done
    4. Drop activities table
    """
    # 1. Add updated_at column to tasks
    op.add_column('tasks', sa.Column(
        'updated_at', sa.DateTime(),
        server_default=sa.text('CURRENT_TIMESTAMP'),
        nullable=True,
    ))

    # 2. Create PostgreSQL trigger for auto-updating updated_at
    op.execute("""
        CREATE OR REPLACE FUNCTION update_tasks_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER tasks_updated_at_trigger
        BEFORE UPDATE ON tasks
        FOR EACH ROW
        EXECUTE FUNCTION update_tasks_updated_at();
    """)

    # 3. Backfill updated_at on existing tasks
    op.execute("""
        UPDATE tasks SET updated_at = COALESCE(created_at, CURRENT_TIMESTAMP)
    """)

    # 4. Migrate activities -> tasks
    op.execute("""
        INSERT INTO tasks (case_id, description, status, completion_date, urgency, sort_order, created_at, updated_at)
        SELECT
            a.case_id,
            CASE
                WHEN a.type IS NOT NULL AND a.type != '' AND a.type != 'Other'
                THEN '[' || a.type || '] ' || a.description
                ELSE a.description
            END,
            'Done',
            a.date,
            'Medium',
            0,
            a.created_at,
            COALESCE(a.created_at, CURRENT_TIMESTAMP)
        FROM activities a
    """)

    # 5. Drop activities table (and its index)
    op.drop_index('idx_activities_case_id', table_name='activities')
    op.drop_table('activities')


def downgrade() -> None:
    """Reverse: recreate activities table. Migrated data stays as tasks."""
    op.create_table(
        'activities',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('case_id', sa.Integer(), nullable=True),
        sa.Column('minutes', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], name='activities_case_id_fkey', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name='activities_pkey'),
    )
    op.create_index('idx_activities_case_id', 'activities', ['case_id'])

    # Remove trigger and function
    op.execute("DROP TRIGGER IF EXISTS tasks_updated_at_trigger ON tasks")
    op.execute("DROP FUNCTION IF EXISTS update_tasks_updated_at()")

    # Remove updated_at column from tasks
    op.drop_column('tasks', 'updated_at')
