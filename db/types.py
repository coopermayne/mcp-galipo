"""
Expertise types and person types functions.
"""

from typing import Optional, List

from .connection import get_cursor


# ===== EXPERTISE TYPE OPERATIONS =====

def get_expertise_types() -> List[dict]:
    """Get all expertise types."""
    with get_cursor() as cur:
        cur.execute("SELECT id, name, description FROM expertise_types ORDER BY name")
        return [dict(row) for row in cur.fetchall()]


def create_expertise_type(name: str, description: str = None) -> dict:
    """Create a new expertise type."""
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO expertise_types (name, description)
            VALUES (%s, %s)
            RETURNING id, name, description
        """, (name, description))
        return dict(cur.fetchone())


def get_expertise_type_by_id(expertise_type_id: int) -> Optional[dict]:
    """Get an expertise type by ID."""
    with get_cursor() as cur:
        cur.execute("SELECT id, name, description FROM expertise_types WHERE id = %s", (expertise_type_id,))
        row = cur.fetchone()
        return dict(row) if row else None


def update_expertise_type(expertise_type_id: int, name: str = None, description: str = None) -> Optional[dict]:
    """Update an expertise type."""
    updates = []
    params = []
    if name is not None:
        updates.append("name = %s")
        params.append(name)
    if description is not None:
        updates.append("description = %s")
        params.append(description)

    if not updates:
        return get_expertise_type_by_id(expertise_type_id)

    params.append(expertise_type_id)
    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE expertise_types SET {', '.join(updates)}
            WHERE id = %s
            RETURNING id, name, description
        """, params)
        row = cur.fetchone()
        return dict(row) if row else None


def delete_expertise_type(expertise_type_id: int) -> bool:
    """Delete an expertise type."""
    with get_cursor() as cur:
        cur.execute("DELETE FROM expertise_types WHERE id = %s", (expertise_type_id,))
        return cur.rowcount > 0


# ===== PERSON TYPE OPERATIONS =====

def get_person_types() -> List[dict]:
    """Get all person types."""
    with get_cursor() as cur:
        cur.execute("SELECT id, name, description FROM person_types ORDER BY name")
        return [dict(row) for row in cur.fetchall()]


def create_person_type(name: str, description: str = None) -> dict:
    """Create a new person type."""
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO person_types (name, description)
            VALUES (%s, %s)
            RETURNING id, name, description
        """, (name, description))
        return dict(cur.fetchone())


def get_person_type_by_id(person_type_id: int) -> Optional[dict]:
    """Get a person type by ID."""
    with get_cursor() as cur:
        cur.execute("SELECT id, name, description FROM person_types WHERE id = %s", (person_type_id,))
        row = cur.fetchone()
        return dict(row) if row else None


def update_person_type(person_type_id: int, name: str = None, description: str = None) -> Optional[dict]:
    """Update a person type."""
    updates = []
    params = []
    if name is not None:
        updates.append("name = %s")
        params.append(name)
    if description is not None:
        updates.append("description = %s")
        params.append(description)

    if not updates:
        return get_person_type_by_id(person_type_id)

    params.append(person_type_id)
    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE person_types SET {', '.join(updates)}
            WHERE id = %s
            RETURNING id, name, description
        """, params)
        row = cur.fetchone()
        return dict(row) if row else None


def delete_person_type(person_type_id: int) -> bool:
    """Delete a person type."""
    with get_cursor() as cur:
        cur.execute("DELETE FROM person_types WHERE id = %s", (person_type_id,))
        return cur.rowcount > 0
