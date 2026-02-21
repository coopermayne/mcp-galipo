"""add ai_analyzing column to intakes

Revision ID: 4f1cefef2f2b
Revises: 8935ddca61f1
Create Date: 2026-02-20 16:12:08.169288

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4f1cefef2f2b'
down_revision: Union[str, Sequence[str], None] = '8935ddca61f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('intakes', sa.Column('ai_analyzing', sa.Boolean(), server_default=sa.text('false'), nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('intakes', 'ai_analyzing')
