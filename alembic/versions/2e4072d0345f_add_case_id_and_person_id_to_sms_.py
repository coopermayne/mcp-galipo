"""add case_id and person_id to sms_conversations

Revision ID: 2e4072d0345f
Revises: 3b0250bc9dd1
Create Date: 2026-05-10 15:27:57.402452

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2e4072d0345f'
down_revision: Union[str, Sequence[str], None] = '3b0250bc9dd1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('sms_conversations', sa.Column('case_id', sa.Integer(), nullable=True))
    op.add_column('sms_conversations', sa.Column('person_id', sa.Integer(), nullable=True))
    op.create_index('idx_sms_conversations_case_id', 'sms_conversations', ['case_id'], unique=False)
    op.create_index('idx_sms_conversations_person_id', 'sms_conversations', ['person_id'], unique=False)
    op.create_foreign_key('sms_conversations_person_id_fkey', 'sms_conversations', 'persons', ['person_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('sms_conversations_case_id_fkey', 'sms_conversations', 'cases', ['case_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('sms_conversations_case_id_fkey', 'sms_conversations', type_='foreignkey')
    op.drop_constraint('sms_conversations_person_id_fkey', 'sms_conversations', type_='foreignkey')
    op.drop_index('idx_sms_conversations_person_id', table_name='sms_conversations')
    op.drop_index('idx_sms_conversations_case_id', table_name='sms_conversations')
    op.drop_column('sms_conversations', 'person_id')
    op.drop_column('sms_conversations', 'case_id')
