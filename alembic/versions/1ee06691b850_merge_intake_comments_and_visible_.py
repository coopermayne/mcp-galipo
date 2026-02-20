"""merge intake_comments and visible_features

Revision ID: 1ee06691b850
Revises: 937ce83ccc7c, a44dee04a67f
Create Date: 2026-02-19 18:32:17.888473

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1ee06691b850'
down_revision: Union[str, Sequence[str], None] = ('937ce83ccc7c', 'a44dee04a67f')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
