"""update intake status default to New

Revision ID: 0d2826b6dcb9
Revises: cd803e398ff9
Create Date: 2026-02-19 13:37:37.454053

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0d2826b6dcb9'
down_revision: Union[str, Sequence[str], None] = 'cd803e398ff9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Change default status from 'Reviewing' to 'New' and migrate existing data."""
    # Update default
    op.alter_column('intakes', 'status',
                    server_default=sa.text("'New'::character varying"))
    # Migrate existing rows
    op.execute("UPDATE intakes SET status = 'New' WHERE status = 'Reviewing'")


def downgrade() -> None:
    """Revert default status back to 'Reviewing'."""
    op.alter_column('intakes', 'status',
                    server_default=sa.text("'Reviewing'::character varying"))
    op.execute("UPDATE intakes SET status = 'Reviewing' WHERE status = 'New'")
