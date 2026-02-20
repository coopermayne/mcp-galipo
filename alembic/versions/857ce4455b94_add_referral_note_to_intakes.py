"""add referral_note to intakes

Revision ID: 857ce4455b94
Revises: 3f216a1f1478
Create Date: 2026-02-20 11:48:23.853358

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '857ce4455b94'
down_revision: Union[str, Sequence[str], None] = '3f216a1f1478'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('intakes', sa.Column('referral_note', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('intakes', 'referral_note')
