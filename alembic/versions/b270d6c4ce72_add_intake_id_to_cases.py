"""add intake_id to cases

Revision ID: b270d6c4ce72
Revises: 4c2e001750ee
Create Date: 2026-05-24 11:03:50.497197

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b270d6c4ce72'
down_revision: Union[str, Sequence[str], None] = '4c2e001750ee'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('cases', sa.Column('intake_id', sa.Integer(), nullable=True))
    op.create_foreign_key('cases_intake_id_fkey', 'cases', 'intakes', ['intake_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('cases_intake_id_fkey', 'cases', type_='foreignkey')
    op.drop_column('cases', 'intake_id')
