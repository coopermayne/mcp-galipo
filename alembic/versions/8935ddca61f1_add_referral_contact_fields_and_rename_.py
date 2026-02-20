"""add referral contact fields and rename referral_note to contact_relationship

Revision ID: 8935ddca61f1
Revises: 857ce4455b94
Create Date: 2026-02-20 12:20:21.719421

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8935ddca61f1'
down_revision: Union[str, Sequence[str], None] = '857ce4455b94'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('intakes', 'referral_note', new_column_name='contact_relationship')
    op.add_column('intakes', sa.Column('referral_name', sa.String(length=255), nullable=True))
    op.add_column('intakes', sa.Column('referral_org', sa.String(length=255), nullable=True))
    op.add_column('intakes', sa.Column('referral_email', sa.String(length=255), nullable=True))
    op.add_column('intakes', sa.Column('referral_phone', sa.String(length=100), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('intakes', 'referral_phone')
    op.drop_column('intakes', 'referral_email')
    op.drop_column('intakes', 'referral_org')
    op.drop_column('intakes', 'referral_name')
    op.alter_column('intakes', 'contact_relationship', new_column_name='referral_note')
