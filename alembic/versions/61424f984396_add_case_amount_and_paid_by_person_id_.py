"""add case_amount and paid_by_person_id to invoices

Revision ID: 61424f984396
Revises: f28a42607cfa
Create Date: 2026-05-08 16:44:20.724051

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '61424f984396'
down_revision: Union[str, Sequence[str], None] = 'f28a42607cfa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('invoices', sa.Column('case_amount', sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column('invoices', sa.Column('paid_by_person_id', sa.Integer(), nullable=True))
    op.create_foreign_key('invoices_paid_by_person_id_fkey', 'invoices', 'persons', ['paid_by_person_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_constraint('invoices_paid_by_person_id_fkey', 'invoices', type_='foreignkey')
    op.drop_column('invoices', 'paid_by_person_id')
    op.drop_column('invoices', 'case_amount')
