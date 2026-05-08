"""add payable_to and payment_address to invoices

Revision ID: f28a42607cfa
Revises: baf354ccdd04
Create Date: 2026-05-08 16:25:41.250644

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f28a42607cfa'
down_revision: Union[str, Sequence[str], None] = 'baf354ccdd04'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('invoices', sa.Column('payable_to', sa.String(length=255), nullable=True))
    op.add_column('invoices', sa.Column('payment_address', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('invoices', 'payment_address')
    op.drop_column('invoices', 'payable_to')
