"""add advances type to invoices and create liens table

Revision ID: 97d64dd0f91b
Revises: 8323800bff0e
Create Date: 2026-05-13 10:15:54.129047

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '97d64dd0f91b'
down_revision: Union[str, Sequence[str], None] = '8323800bff0e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('liens',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('case_id', sa.Integer(), nullable=False),
    sa.Column('payee_id', sa.Integer(), nullable=True),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('claimed_amount', sa.Numeric(precision=14, scale=2), nullable=False),
    sa.Column('negotiated_amount', sa.Numeric(precision=14, scale=2), nullable=True),
    sa.Column('status', sa.String(length=20), server_default=sa.text("'pending'::character varying"), nullable=False),
    sa.Column('date', sa.Date(), nullable=True),
    sa.Column('paid_date', sa.Date(), nullable=True),
    sa.Column('check_number', sa.String(length=50), nullable=True),
    sa.Column('file_path', sa.Text(), nullable=True),
    sa.Column('file_name', sa.String(length=255), nullable=True),
    sa.Column('content_type', sa.String(length=100), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.ForeignKeyConstraint(['case_id'], ['cases.id'], name='liens_case_id_fkey', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['payee_id'], ['payees.id'], name='liens_payee_id_fkey', ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name='liens_pkey')
    )
    op.create_index('idx_liens_case_id', 'liens', ['case_id'], unique=False)
    op.create_index('idx_liens_status', 'liens', ['status'], unique=False)
    op.add_column('invoices', sa.Column('type', sa.String(length=20), server_default=sa.text("'cost'::character varying"), nullable=False))
    op.add_column('invoices', sa.Column('advanced_to_person_id', sa.Integer(), nullable=True))
    op.create_index('idx_invoices_type', 'invoices', ['type'], unique=False)
    op.create_foreign_key('invoices_advanced_to_person_id_fkey', 'invoices', 'persons', ['advanced_to_person_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('invoices_advanced_to_person_id_fkey', 'invoices', type_='foreignkey')
    op.drop_index('idx_invoices_type', table_name='invoices')
    op.drop_column('invoices', 'advanced_to_person_id')
    op.drop_column('invoices', 'type')
    op.drop_index('idx_liens_status', table_name='liens')
    op.drop_index('idx_liens_case_id', table_name='liens')
    op.drop_table('liens')
