"""add payees table and replace vendor columns on invoices

Revision ID: b5f092617191
Revises: 61424f984396
Create Date: 2026-05-09 10:23:48.050355

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b5f092617191'
down_revision: Union[str, Sequence[str], None] = '61424f984396'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'payees',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('w9_file_path', sa.Text(), nullable=True),
        sa.Column('w9_file_name', sa.String(length=255), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.PrimaryKeyConstraint('id', name='payees_pkey'),
    )
    op.create_index('idx_payees_name', 'payees', ['name'])

    op.add_column('invoices', sa.Column('payee_id', sa.Integer(), nullable=True))
    op.create_foreign_key('invoices_payee_id_fkey', 'invoices', 'payees', ['payee_id'], ['id'], ondelete='SET NULL')

    op.drop_column('invoices', 'vendor')
    op.drop_column('invoices', 'payable_to')
    op.drop_column('invoices', 'payment_address')


def downgrade() -> None:
    op.add_column('invoices', sa.Column('payment_address', sa.Text(), nullable=True))
    op.add_column('invoices', sa.Column('payable_to', sa.String(length=255), nullable=True))
    op.add_column('invoices', sa.Column('vendor', sa.String(length=255), nullable=False, server_default=''))

    op.drop_constraint('invoices_payee_id_fkey', 'invoices', type_='foreignkey')
    op.drop_column('invoices', 'payee_id')

    op.drop_index('idx_payees_name', table_name='payees')
    op.drop_table('payees')
