"""rename payee check_name to pay_to

Revision ID: 8323800bff0e
Revises: 5d7831bba25c
Create Date: 2026-05-13 09:07:55.132668

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '8323800bff0e'
down_revision: Union[str, Sequence[str], None] = '5d7831bba25c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('payees', 'check_name', new_column_name='pay_to')


def downgrade() -> None:
    op.alter_column('payees', 'pay_to', new_column_name='check_name')
