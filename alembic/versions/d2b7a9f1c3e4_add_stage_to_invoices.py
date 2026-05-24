"""add workflow stage to invoices

Revision ID: d2b7a9f1c3e4
Revises: c1ac1736501b
Create Date: 2026-05-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd2b7a9f1c3e4'
down_revision: Union[str, Sequence[str], None] = 'c1ac1736501b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'invoices',
        sa.Column(
            'stage',
            sa.String(length=30),
            server_default=sa.text("'Received'::character varying"),
            nullable=False,
        ),
    )
    # Existing paid invoices belong in the terminal "Paid" stage.
    op.execute("UPDATE invoices SET stage = 'Paid' WHERE status = 'paid'")
    op.create_index('idx_invoices_stage', 'invoices', ['stage'], unique=False)


def downgrade() -> None:
    op.drop_index('idx_invoices_stage', table_name='invoices')
    op.drop_column('invoices', 'stage')
