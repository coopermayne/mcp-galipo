"""add token_usage_log table

Revision ID: 639396e1dc67
Revises: c1ac1736501b
Create Date: 2026-05-23 23:44:43.328085

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '639396e1dc67'
down_revision: Union[str, Sequence[str], None] = 'c1ac1736501b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'token_usage_log',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('source', sa.String(length=50), nullable=False),
        sa.Column('request_type', sa.String(length=64), nullable=True),
        sa.Column('model', sa.String(length=100), nullable=True),
        sa.Column('input_tokens', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('output_tokens', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('cache_creation_input_tokens', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('cache_read_input_tokens', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('estimated_cost_usd', sa.Numeric(precision=12, scale=6), nullable=True),
        sa.Column('case_id', sa.Integer(), nullable=True),
        sa.Column('username', sa.String(length=255), nullable=True),
        sa.Column('conversation_id', sa.String(length=64), nullable=True),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('meta', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.PrimaryKeyConstraint('id', name='token_usage_log_pkey'),
    )
    op.create_index('idx_token_usage_log_created_at', 'token_usage_log', ['created_at'], unique=False)
    op.create_index('idx_token_usage_log_source', 'token_usage_log', ['source'], unique=False)
    op.create_index('idx_token_usage_log_request_type', 'token_usage_log', ['request_type'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_token_usage_log_request_type', table_name='token_usage_log')
    op.drop_index('idx_token_usage_log_source', table_name='token_usage_log')
    op.drop_index('idx_token_usage_log_created_at', table_name='token_usage_log')
    op.drop_table('token_usage_log')
