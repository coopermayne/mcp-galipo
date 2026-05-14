"""add flexible cost sharing config and invoice phase_id

Revision ID: 274c0f660dad
Revises: 737cceef5114
Create Date: 2026-05-14 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '274c0f660dad'
down_revision: Union[str, Sequence[str], None] = '737cceef5114'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'cases',
        sa.Column('cost_sharing_config', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column('invoices', sa.Column('phase_id', sa.Text(), nullable=True))
    op.create_index('idx_invoices_phase_id', 'invoices', ['phase_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_invoices_phase_id', table_name='invoices')
    op.drop_column('invoices', 'phase_id')
    op.drop_column('cases', 'cost_sharing_config')
