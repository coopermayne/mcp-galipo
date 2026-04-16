"""add trial_date claim_deadline complaint_deadline to cases

Revision ID: 4f4fdfd888ea
Revises: 5748aa2a68ad
Create Date: 2026-04-16 09:36:52.520012

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4f4fdfd888ea'
down_revision: Union[str, Sequence[str], None] = '5748aa2a68ad'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('cases', sa.Column('trial_date', sa.Date(), nullable=True))
    op.add_column('cases', sa.Column('claim_deadline', sa.Date(), nullable=True))
    op.add_column('cases', sa.Column('complaint_deadline', sa.Date(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('cases', 'complaint_deadline')
    op.drop_column('cases', 'claim_deadline')
    op.drop_column('cases', 'trial_date')
