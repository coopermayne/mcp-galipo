"""add blocks_calendar to events

Revision ID: 2e18f4b5f944
Revises: 737cceef5114
Create Date: 2026-05-14 14:23:49.016246

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '2e18f4b5f944'
down_revision: Union[str, Sequence[str], None] = '737cceef5114'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('events', sa.Column('blocks_calendar', sa.Boolean(), server_default=sa.text('false'), nullable=True))
    # Backfill: existing events with event_type set were showing on the trial calendar
    op.execute("UPDATE events SET blocks_calendar = true WHERE event_type IS NOT NULL")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('events', 'blocks_calendar')
