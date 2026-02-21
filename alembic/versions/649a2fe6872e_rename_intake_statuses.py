"""rename intake statuses

Revision ID: 649a2fe6872e
Revises: 4f1cefef2f2b
Create Date: 2026-02-20 17:39:43.241250

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '649a2fe6872e'
down_revision: Union[str, Sequence[str], None] = '4f1cefef2f2b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


RENAMES = [
    ("Screened", "Dave Review"),
    ("Rejected", "Needs Rejection Letter"),
    ("Rejection Sent", "Rejection Letter Sent"),
    ("Send Retainer", "Needs Retainer"),
    ("Retained", "Retainer Signed"),
]


def upgrade() -> None:
    for old, new in RENAMES:
        op.execute(
            sa.text("UPDATE intakes SET status = :new WHERE status = :old")
            .bindparams(old=old, new=new)
        )


def downgrade() -> None:
    for old, new in RENAMES:
        op.execute(
            sa.text("UPDATE intakes SET status = :old WHERE status = :new")
            .bindparams(old=old, new=new)
        )
