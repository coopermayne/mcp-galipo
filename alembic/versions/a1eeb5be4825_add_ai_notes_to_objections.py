"""add ai_notes to objections

Revision ID: a1eeb5be4825
Revises: 45b7e722cbb7
Create Date: 2026-02-13 17:03:49.316001

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1eeb5be4825'
down_revision: Union[str, Sequence[str], None] = '45b7e722cbb7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('objections', sa.Column('ai_notes', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('objections', 'ai_notes')
