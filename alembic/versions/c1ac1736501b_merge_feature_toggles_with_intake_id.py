"""merge feature_toggles with intake_id

Revision ID: c1ac1736501b
Revises: a1f4e2c83b91, ded88db86b31
Create Date: 2026-05-23 08:37:46.454985

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1ac1736501b'
down_revision: Union[str, Sequence[str], None] = ('a1f4e2c83b91', 'ded88db86b31')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
