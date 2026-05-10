"""add w9_year to payees

Revision ID: 6f50fedd1758
Revises: b5f092617191
Create Date: 2026-05-09 17:35:46.588672

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6f50fedd1758'
down_revision: Union[str, Sequence[str], None] = 'b5f092617191'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('payees', sa.Column('w9_year', sa.Integer(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('payees', 'w9_year')
