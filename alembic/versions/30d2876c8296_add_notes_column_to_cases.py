"""add notes column to cases

Revision ID: 30d2876c8296
Revises: 2cea46dbbb57
Create Date: 2026-02-25 08:01:35.185948

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '30d2876c8296'
down_revision: Union[str, Sequence[str], None] = '2cea46dbbb57'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add notes TEXT column to cases and migrate existing note records."""
    # 1. Add the column
    op.add_column('cases', sa.Column('notes', sa.Text(), nullable=True))

    # 2. Migrate existing note records into the new column.
    #    For each case, concatenate notes (newest first) separated by ---
    op.execute(sa.text("""
        UPDATE cases
        SET notes = sub.combined_notes
        FROM (
            SELECT
                n.case_id,
                string_agg(n.content, E'\n\n---\n\n' ORDER BY n.created_at DESC) AS combined_notes
            FROM notes n
            WHERE n.case_id IS NOT NULL
            GROUP BY n.case_id
        ) sub
        WHERE cases.id = sub.case_id
    """))


def downgrade() -> None:
    """Remove notes column from cases."""
    op.drop_column('cases', 'notes')
