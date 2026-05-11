"""add transfer_to_person_id to invoices

Revision ID: 5d7831bba25c
Revises: e505f9b14d80
Create Date: 2026-05-11 16:09:03.546810

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '5d7831bba25c'
down_revision: Union[str, Sequence[str], None] = 'e505f9b14d80'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('invoices', sa.Column('transfer_to_person_id', sa.Integer(), nullable=True))
    op.create_foreign_key('invoices_transfer_to_person_id_fkey', 'invoices', 'persons', ['transfer_to_person_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('invoices_transfer_to_person_id_fkey', 'invoices', type_='foreignkey')
    op.drop_column('invoices', 'transfer_to_person_id')
