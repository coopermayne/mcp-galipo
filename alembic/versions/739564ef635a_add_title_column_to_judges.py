"""add title column to judges

Revision ID: 739564ef635a
Revises: d1be47e0ce2c
Create Date: 2026-02-07 15:18:04.601576

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '739564ef635a'
down_revision: Union[str, Sequence[str], None] = 'd1be47e0ce2c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('judges', sa.Column('title', sa.String(length=100), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('judges', 'title')
