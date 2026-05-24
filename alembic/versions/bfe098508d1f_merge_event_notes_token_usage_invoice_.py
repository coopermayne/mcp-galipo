"""merge event_notes, token_usage, invoice_stage

Revision ID: bfe098508d1f
Revises: 1fafb4a8ba5e, 639396e1dc67, d2b7a9f1c3e4
Create Date: 2026-05-24 07:43:40.933174

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bfe098508d1f'
down_revision: Union[str, Sequence[str], None] = ('1fafb4a8ba5e', '639396e1dc67', 'd2b7a9f1c3e4')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
