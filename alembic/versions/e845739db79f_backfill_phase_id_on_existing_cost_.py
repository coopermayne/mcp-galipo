"""backfill phase_id on existing cost-sharing invoices

Revision ID: e845739db79f
Revises: 274c0f660dad
Create Date: 2026-05-14 20:00:53.831255

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = 'e845739db79f'
down_revision: Union[str, Sequence[str], None] = '274c0f660dad'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(text(
        "UPDATE invoices SET phase_id = 'phase-1'"
        " WHERE case_id IN (SELECT id FROM cases WHERE cost_sharing_config IS NOT NULL)"
        " AND phase_id IS NULL"
    ))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(text(
        "UPDATE invoices SET phase_id = NULL"
        " WHERE phase_id = 'phase-1'"
    ))
