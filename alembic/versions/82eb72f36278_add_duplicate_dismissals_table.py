"""add duplicate_dismissals table

Revision ID: 82eb72f36278
Revises: cca0c5748b6a
Create Date: 2026-05-13 16:01:56.330081

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '82eb72f36278'
down_revision: Union[str, Sequence[str], None] = 'cca0c5748b6a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('duplicate_dismissals',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('person_id_a', sa.Integer(), nullable=False),
    sa.Column('person_id_b', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.ForeignKeyConstraint(['person_id_a'], ['persons.id'], name='duplicate_dismissals_person_id_a_fkey', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['person_id_b'], ['persons.id'], name='duplicate_dismissals_person_id_b_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='duplicate_dismissals_pkey'),
    sa.UniqueConstraint('person_id_a', 'person_id_b', name='uq_duplicate_dismissals_pair')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('duplicate_dismissals')
