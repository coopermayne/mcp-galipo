"""add aliases column to jurisdictions

Revision ID: 0e3bf62c4c1d
Revises: bcac9095af3b
Create Date: 2026-02-17 16:06:55.718532

"""
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0e3bf62c4c1d'
down_revision: Union[str, Sequence[str], None] = 'bcac9095af3b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Aliases for existing jurisdictions
JURISDICTION_ALIASES = {
    "C.D. Cal.": ["CACD", "CD Cal", "Central District of California", "Central District California", "Central District"],
    "E.D. Cal.": ["CAED", "ED Cal", "Eastern District of California", "Eastern District California", "Eastern District"],
    "N.D. Cal.": ["CAND", "ND Cal", "Northern District of California", "Northern District California", "Northern District"],
    "S.D. Cal.": ["CASD", "SD Cal", "Southern District of California", "Southern District California", "Southern District"],
    "9th Cir.": ["CA9", "9th Circuit", "Ninth Circuit", "Ninth Cir", "9th Cir"],
    "Los Angeles Superior": ["LASC", "LA Superior", "LA Superior Court", "Los Angeles Superior Court"],
    "Orange County Superior": ["OC Superior", "OC Superior Court", "Orange County Superior Court"],
    "San Diego Superior": ["SD Superior", "San Diego Superior Court"],
    "Riverside Superior": ["Riverside Superior Court"],
    "San Bernardino Superior": ["San Bernardino Superior Court", "SB Superior"],
}


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('jurisdictions', sa.Column('aliases', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=True))

    # Populate aliases for existing jurisdictions
    conn = op.get_bind()
    for name, aliases in JURISDICTION_ALIASES.items():
        conn.execute(
            sa.text("UPDATE jurisdictions SET aliases = CAST(:aliases AS jsonb) WHERE name = :name"),
            {"aliases": json.dumps(aliases), "name": name},
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('jurisdictions', 'aliases')
