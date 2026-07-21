"""backfill NULL case feature_toggles to all-enabled

Revision ID: db2cb98cdc1b
Revises: a1f4c9d27e83
Create Date: 2026-07-21 11:17:34.542869

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'db2cb98cdc1b'
down_revision: Union[str, Sequence[str], None] = 'a1f4c9d27e83'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Backfill cases created with a NULL feature_toggles.

    A NULL feature_toggles reads as "every feature disabled" (see
    db/feature_gates.py:is_feature_enabled), which silently blocked saving
    events (including trial-calendar events like FPTC), tasks, etc. on any
    case created through the normal flow. New cases now default to all-enabled;
    this repairs existing rows. Idempotent — only touches NULL rows.
    """
    op.execute(
        """
        UPDATE cases
        SET feature_toggles = '{"tasks": true, "events": true, "financials": true, "costs": true, "documents": true}'::jsonb
        WHERE feature_toggles IS NULL
        """
    )


def downgrade() -> None:
    """No-op: cannot distinguish backfilled rows from intentionally-enabled ones."""
    pass
