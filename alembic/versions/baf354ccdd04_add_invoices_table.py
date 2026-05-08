"""add invoices table

Revision ID: baf354ccdd04
Revises: 02c29fa7fa30
Create Date: 2026-05-08 15:21:37.743017

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'baf354ccdd04'
down_revision: Union[str, Sequence[str], None] = '02c29fa7fa30'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('invoices',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('case_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), server_default=sa.text("'unpaid'::character varying"), nullable=False),
        sa.Column('vendor', sa.String(length=255), nullable=False),
        sa.Column('amount', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('date', sa.Date(), nullable=True),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(length=50), nullable=True),
        sa.Column('check_number', sa.String(length=50), nullable=True),
        sa.Column('paid_date', sa.Date(), nullable=True),
        sa.Column('file_path', sa.Text(), nullable=True),
        sa.Column('file_name', sa.String(length=255), nullable=True),
        sa.Column('content_type', sa.String(length=100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], name='invoices_case_id_fkey', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name='invoices_pkey')
    )
    op.create_index('idx_invoices_case_id', 'invoices', ['case_id'], unique=False)
    op.create_index('idx_invoices_date', 'invoices', ['date'], unique=False)
    op.create_index('idx_invoices_due_date', 'invoices', ['due_date'], unique=False)
    op.create_index('idx_invoices_status', 'invoices', ['status'], unique=False)


def downgrade() -> None:
    op.drop_index('idx_invoices_status', table_name='invoices')
    op.drop_index('idx_invoices_due_date', table_name='invoices')
    op.drop_index('idx_invoices_date', table_name='invoices')
    op.drop_index('idx_invoices_case_id', table_name='invoices')
    op.drop_table('invoices')
