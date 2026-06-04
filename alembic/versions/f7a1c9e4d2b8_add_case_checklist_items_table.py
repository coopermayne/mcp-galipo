"""add case_checklist_items table

Revision ID: f7a1c9e4d2b8
Revises: 119108f0b1bc
Create Date: 2026-06-04 17:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f7a1c9e4d2b8'
down_revision: Union[str, Sequence[str], None] = '119108f0b1bc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'case_checklist_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('case_id', sa.Integer(), nullable=False),
        sa.Column('item_key', sa.String(length=60), nullable=False),
        sa.Column('label', sa.String(length=120), nullable=True),
        sa.Column('status', sa.String(length=20),
                  server_default=sa.text("'needed'::character varying"), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'],
                                name='case_checklist_items_case_id_fkey', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name='case_checklist_items_pkey'),
        sa.UniqueConstraint('case_id', 'item_key', name='uq_case_checklist_items_case_key'),
    )
    op.create_index('idx_case_checklist_items_case_id', 'case_checklist_items', ['case_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_case_checklist_items_case_id', table_name='case_checklist_items')
    op.drop_table('case_checklist_items')
