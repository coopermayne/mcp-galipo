"""add cost sharing fields to person_roles

Revision ID: e505f9b14d80
Revises: 58c28388b809
Create Date: 2026-05-11 15:41:30.566207

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e505f9b14d80'
down_revision: Union[str, Sequence[str], None] = '58c28388b809'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('person_roles', sa.Column('cost_share_pct', sa.Numeric(precision=5, scale=2), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('person_roles', 'cost_share_pct')
