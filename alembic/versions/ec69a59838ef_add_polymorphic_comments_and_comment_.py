"""add polymorphic comments and comment_reads tables

Revision ID: ec69a59838ef
Revises: 2e4072d0345f
Create Date: 2026-05-10 20:18:08.441200

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'ec69a59838ef'
down_revision: Union[str, Sequence[str], None] = '2e4072d0345f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('comment_reads',
    sa.Column('entity_type', sa.String(length=50), nullable=False),
    sa.Column('entity_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('last_read_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='comment_reads_user_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('entity_type', 'entity_id', 'user_id', name='comment_reads_pkey')
    )
    op.create_table('comments',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('entity_type', sa.String(length=50), nullable=False),
    sa.Column('entity_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('is_system', sa.Boolean(), server_default=sa.text('false'), nullable=True),
    sa.Column('detail', postgresql.JSONB(none_as_null=True, astext_type=sa.Text()), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='comments_user_id_fkey', ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name='comments_pkey')
    )
    op.create_index('idx_comments_entity', 'comments', ['entity_type', 'entity_id'], unique=False)
    op.create_index('idx_comments_user_id', 'comments', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_comments_user_id', table_name='comments')
    op.drop_index('idx_comments_entity', table_name='comments')
    op.drop_table('comments')
    op.drop_table('comment_reads')
