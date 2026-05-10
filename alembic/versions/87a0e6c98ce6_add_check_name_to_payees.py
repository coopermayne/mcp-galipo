"""add check_name to payees

Revision ID: 87a0e6c98ce6
Revises: 6f50fedd1758
Create Date: 2026-05-09 17:41:57.244956

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '87a0e6c98ce6'
down_revision: Union[str, Sequence[str], None] = '6f50fedd1758'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('payees', sa.Column('check_name', sa.String(length=255), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('payees', 'check_name')
