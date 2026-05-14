"""backfill sol deadlines from doi

Revision ID: 3f3e5f71d535
Revises: 2e18f4b5f944
Create Date: 2026-05-14 14:51:44.917254

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '3f3e5f71d535'
down_revision: Union[str, Sequence[str], None] = '2e18f4b5f944'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Backfill claim_deadline (DOI + 6 months) where DOI exists but deadline is null
    op.execute("""
        UPDATE cases
        SET claim_deadline = (date_of_injury + INTERVAL '6 months')::date
        WHERE date_of_injury IS NOT NULL
          AND claim_deadline IS NULL
    """)

    # Backfill complaint_deadline (DOI + 2 years) where DOI exists but deadline is null
    op.execute("""
        UPDATE cases
        SET complaint_deadline = (date_of_injury + INTERVAL '2 years')::date
        WHERE date_of_injury IS NOT NULL
          AND complaint_deadline IS NULL
    """)


def downgrade() -> None:
    pass
