"""
Jurisdiction CRUD operations.
"""

from typing import Optional, List

from .connection import get_cursor


def get_jurisdictions() -> List[dict]:
    """Get all jurisdictions."""
    with get_cursor() as cur:
        cur.execute("SELECT id, name, local_rules_link, notes FROM jurisdictions ORDER BY name")
        return [dict(row) for row in cur.fetchall()]


def get_jurisdiction_by_id(jurisdiction_id: int) -> Optional[dict]:
    """Get a jurisdiction by ID."""
    with get_cursor() as cur:
        cur.execute("SELECT id, name, local_rules_link, notes FROM jurisdictions WHERE id = %s", (jurisdiction_id,))
        row = cur.fetchone()
        return dict(row) if row else None


def get_jurisdiction_by_name(name: str) -> Optional[dict]:
    """Get a jurisdiction by name."""
    with get_cursor() as cur:
        cur.execute("SELECT id, name, local_rules_link, notes FROM jurisdictions WHERE name = %s", (name,))
        row = cur.fetchone()
        return dict(row) if row else None


def create_jurisdiction(name: str, local_rules_link: str = None, notes: str = None) -> dict:
    """Create a new jurisdiction."""
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO jurisdictions (name, local_rules_link, notes)
            VALUES (%s, %s, %s)
            RETURNING id, name, local_rules_link, notes
        """, (name, local_rules_link, notes))
        return dict(cur.fetchone())


def update_jurisdiction(jurisdiction_id: int, name: str = None, local_rules_link: str = None, notes: str = None) -> Optional[dict]:
    """Update a jurisdiction."""
    updates = []
    params = []
    if name is not None:
        updates.append("name = %s")
        params.append(name)
    if local_rules_link is not None:
        updates.append("local_rules_link = %s")
        params.append(local_rules_link)
    if notes is not None:
        updates.append("notes = %s")
        params.append(notes)

    if not updates:
        return get_jurisdiction_by_id(jurisdiction_id)

    params.append(jurisdiction_id)
    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE jurisdictions SET {', '.join(updates)}
            WHERE id = %s
            RETURNING id, name, local_rules_link, notes
        """, params)
        row = cur.fetchone()
        return dict(row) if row else None


def delete_jurisdiction(jurisdiction_id: int) -> bool:
    """Delete a jurisdiction. Will fail if cases are still referencing it."""
    with get_cursor() as cur:
        cur.execute("DELETE FROM jurisdictions WHERE id = %s", (jurisdiction_id,))
        return cur.rowcount > 0
