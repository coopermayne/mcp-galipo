"""add proposed_trial_dates to cases

Revision ID: 737cceef5114
Revises: 82eb72f36278
Create Date: 2026-05-14 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '737cceef5114'
down_revision: Union[str, Sequence[str], None] = '82eb72f36278'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('cases', sa.Column('proposed_trial_dates', sa.ARRAY(sa.Date()), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('cases', 'proposed_trial_dates')
