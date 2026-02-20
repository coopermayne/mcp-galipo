"""make google_row_number nullable

Revision ID: 3f216a1f1478
Revises: 1ee06691b850
Create Date: 2026-02-20 11:30:08.979638

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3f216a1f1478'
down_revision: Union[str, Sequence[str], None] = '1ee06691b850'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('intakes', 'google_row_number',
               existing_type=sa.INTEGER(),
               nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('intakes', 'google_row_number',
               existing_type=sa.INTEGER(),
               nullable=False)
