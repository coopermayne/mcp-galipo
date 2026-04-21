"""add last_active_at to users and page_views table

Revision ID: 02c29fa7fa30
Revises: 4f4fdfd888ea
Create Date: 2026-04-21 10:19:07.984594

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '02c29fa7fa30'
down_revision: Union[str, Sequence[str], None] = '4f4fdfd888ea'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('page_views',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('path', sa.String(length=500), nullable=False),
    sa.Column('viewed_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='page_views_user_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='page_views_pkey')
    )
    op.create_index('idx_page_views_path', 'page_views', ['path'], unique=False)
    op.create_index('idx_page_views_user_id', 'page_views', ['user_id'], unique=False)
    op.create_index('idx_page_views_viewed_at', 'page_views', ['viewed_at'], unique=False)
    op.add_column('users', sa.Column('last_active_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'last_active_at')
    op.drop_index('idx_page_views_viewed_at', table_name='page_views')
    op.drop_index('idx_page_views_user_id', table_name='page_views')
    op.drop_index('idx_page_views_path', table_name='page_views')
    op.drop_table('page_views')
