"""add is_transfer to invoices

Revision ID: 58c28388b809
Revises: ec69a59838ef
Create Date: 2026-05-11 15:27:04.809687

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '58c28388b809'
down_revision: Union[str, Sequence[str], None] = 'ec69a59838ef'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('invoices', sa.Column('is_transfer', sa.Boolean(), server_default=sa.text('false'), nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('invoices', 'is_transfer')
