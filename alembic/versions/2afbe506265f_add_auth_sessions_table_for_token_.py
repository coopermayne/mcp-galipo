"""add auth_sessions table for token revocation

Revision ID: 2afbe506265f
Revises: 87a0e6c98ce6
Create Date: 2026-05-10 12:02:59.238013

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '2afbe506265f'
down_revision: Union[str, Sequence[str], None] = '87a0e6c98ce6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('auth_sessions',
    sa.Column('sid', sa.String(length=64), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.Column('expires_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='auth_sessions_user_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('sid', name='auth_sessions_pkey')
    )
    op.create_index('idx_auth_sessions_expires_at', 'auth_sessions', ['expires_at'], unique=False)
    op.create_index('idx_auth_sessions_user_id', 'auth_sessions', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_auth_sessions_user_id', table_name='auth_sessions')
    op.drop_index('idx_auth_sessions_expires_at', table_name='auth_sessions')
    op.drop_table('auth_sessions')
