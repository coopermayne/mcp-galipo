"""add trial_estimated_days to cases and event_type end_date to events

Revision ID: cca0c5748b6a
Revises: 1ca9ac7115e3
Create Date: 2026-05-13 12:05:08.745396

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cca0c5748b6a'
down_revision: Union[str, Sequence[str], None] = '1ca9ac7115e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('cases', sa.Column('trial_estimated_days', sa.Integer(), nullable=True))
    op.add_column('events', sa.Column('event_type', sa.String(length=50), nullable=True))
    op.add_column('events', sa.Column('end_date', sa.Date(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('events', 'end_date')
    op.drop_column('events', 'event_type')
    op.drop_column('cases', 'trial_estimated_days')
