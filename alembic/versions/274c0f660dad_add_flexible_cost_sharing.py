"""add flexible cost sharing config and invoice phase_id

Revision ID: 274c0f660dad
Revises: 3f3e5f71d535, a44dee04a67f
Create Date: 2026-05-14 10:00:00.000000

"""
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '274c0f660dad'
down_revision: Union[str, Sequence[str], None] = ('3f3e5f71d535', 'a44dee04a67f')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'cases',
        sa.Column('cost_sharing_config', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column('invoices', sa.Column('phase_id', sa.Text(), nullable=True))
    op.create_index('idx_invoices_phase_id', 'invoices', ['phase_id'])

    conn = op.get_bind()
    rows = conn.execute(text("""
        SELECT pr.case_id, pr.person_id, pr.cost_share_pct, p.name, p.organization
        FROM person_roles pr
        JOIN persons p ON p.id = pr.person_id
        WHERE pr.role_id = 5 AND pr.cost_share_pct IS NOT NULL
    """)).fetchall()
    for case_id, person_id, pct, name, organization in rows:
        pct = float(pct)
        our_pct = round(100.0 - pct, 2)
        party_id = f"p:{person_id}"
        config = {
            "version": 1,
            "parties": [
                {"id": "ours", "label": "Our Firm"},
                {"id": party_id, "person_id": person_id, "label": name, "organization": organization},
            ],
            "phases": [{
                "id": "phase-1",
                "label": "Default",
                "boundary_kind": "open_start",
                "boundary_date": None,
                "shares": [
                    {"party": "ours", "pct": our_pct},
                    {"party": party_id, "pct": pct},
                ],
                "caps": [],
            }],
            "absorber_party": "ours",
        }
        conn.execute(
            text("UPDATE cases SET cost_sharing_config = :config WHERE id = :case_id"),
            {"config": json.dumps(config), "case_id": case_id},
        )
    conn.execute(text(
        "UPDATE person_roles SET cost_share_pct = NULL WHERE role_id = 5 AND cost_share_pct IS NOT NULL"
    ))
    conn.execute(text(
        "UPDATE invoices SET phase_id = 'phase-1'"
        " WHERE case_id IN (SELECT id FROM cases WHERE cost_sharing_config IS NOT NULL)"
        " AND phase_id IS NULL"
    ))


def downgrade() -> None:
    op.drop_index('idx_invoices_phase_id', table_name='invoices')
    op.drop_column('invoices', 'phase_id')
    op.drop_column('cases', 'cost_sharing_config')
