"""add ai_injury_rating column to intakes

Revision ID: 4a695b9ae955
Revises: 30d2876c8296
Create Date: 2026-02-25 13:18:09.304388

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4a695b9ae955'
down_revision: Union[str, Sequence[str], None] = '30d2876c8296'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('intakes', sa.Column('ai_injury_rating', sa.Integer(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('intakes', 'ai_injury_rating')
