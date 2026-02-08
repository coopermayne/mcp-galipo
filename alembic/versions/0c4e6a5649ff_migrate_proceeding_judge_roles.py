"""migrate proceeding judge roles

Revision ID: 0c4e6a5649ff
Revises: 739564ef635a
Create Date: 2026-02-07 15:50:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '0c4e6a5649ff'
down_revision: Union[str, Sequence[str], None] = '739564ef635a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Migrate proceeding_judges.role values to new vocabulary.

    Old: Judge, Magistrate Judge, Presiding, Panel
    New: Presiding, Magistrate, Panel, Other

    Mapping:
      'Judge'           -> 'Presiding'
      'Magistrate Judge' -> 'Magistrate'
      (Presiding, Panel stay the same)
    """
    op.execute("UPDATE proceeding_judges SET role = 'Presiding' WHERE role = 'Judge'")
    op.execute("UPDATE proceeding_judges SET role = 'Magistrate' WHERE role = 'Magistrate Judge'")


def downgrade() -> None:
    """Revert proceeding_judges.role values to old vocabulary."""
    op.execute("UPDATE proceeding_judges SET role = 'Judge' WHERE role = 'Presiding'")
    op.execute("UPDATE proceeding_judges SET role = 'Magistrate Judge' WHERE role = 'Magistrate'")
