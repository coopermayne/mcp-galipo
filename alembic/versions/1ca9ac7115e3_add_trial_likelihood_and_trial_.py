"""add trial_likelihood and trial_likelihood_note to cases

Revision ID: 1ca9ac7115e3
Revises: 97d64dd0f91b
Create Date: 2026-05-13 11:10:58.712325

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1ca9ac7115e3'
down_revision: Union[str, Sequence[str], None] = '97d64dd0f91b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('cases', sa.Column('trial_likelihood', sa.Integer(), nullable=True))
    op.add_column('cases', sa.Column('trial_likelihood_note', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('cases', 'trial_likelihood_note')
    op.drop_column('cases', 'trial_likelihood')
