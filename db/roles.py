"""
Roles management functions.

Roles replace the old person_types system, providing categorized role definitions
that can be assigned to persons via the person_roles junction table.
"""

from typing import Optional, List

from .connection import get_cursor, serialize_rows


def get_roles(category: str = None) -> List[dict]:
    """Get all roles, optionally filtered by category.

    Categories: 'client', 'internal_team', 'opposing_team', 'third_party'
    """
    with get_cursor() as cur:
        if category:
            cur.execute("""
                SELECT id, name, category, sort_order, description, created_at
                FROM roles
                WHERE category = %s
                ORDER BY sort_order, name
            """, (category,))
        else:
            cur.execute("""
                SELECT id, name, category, sort_order, description, created_at
                FROM roles
                ORDER BY category, sort_order, name
            """)
        return serialize_rows([dict(row) for row in cur.fetchall()])


def get_role_by_id(role_id: int) -> Optional[dict]:
    """Get a single role by ID."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT id, name, category, sort_order, description, created_at
            FROM roles WHERE id = %s
        """, (role_id,))
        row = cur.fetchone()
        return dict(row) if row else None


def get_role_by_name(name: str) -> Optional[dict]:
    """Get a role by name (case-insensitive)."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT id, name, category, sort_order, description, created_at
            FROM roles WHERE LOWER(name) = LOWER(%s)
        """, (name,))
        row = cur.fetchone()
        return dict(row) if row else None


def create_role(name: str, category: str, sort_order: int = 0,
                description: str = None) -> dict:
    """Create a new role."""
    valid_categories = ['client', 'internal_team', 'opposing_team', 'third_party']
    if category not in valid_categories:
        from .validation import ValidationError
        raise ValidationError(f"Invalid category '{category}'. Must be one of: {valid_categories}")

    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO roles (name, category, sort_order, description)
            VALUES (%s, %s, %s, %s)
            RETURNING id, name, category, sort_order, description, created_at
        """, (name, category, sort_order, description))
        return dict(cur.fetchone())


def update_role(role_id: int, name: str = None, category: str = None,
                sort_order: int = None, description: str = None) -> Optional[dict]:
    """Update a role."""
    updates = []
    params = []

    if name is not None:
        updates.append("name = %s")
        params.append(name)

    if category is not None:
        valid_categories = ['client', 'internal_team', 'opposing_team', 'third_party']
        if category not in valid_categories:
            from .validation import ValidationError
            raise ValidationError(f"Invalid category '{category}'. Must be one of: {valid_categories}")
        updates.append("category = %s")
        params.append(category)

    if sort_order is not None:
        updates.append("sort_order = %s")
        params.append(sort_order)

    if description is not None:
        updates.append("description = %s")
        params.append(description)

    if not updates:
        return get_role_by_id(role_id)

    params.append(role_id)

    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE roles SET {', '.join(updates)}
            WHERE id = %s
            RETURNING id, name, category, sort_order, description, created_at
        """, params)
        row = cur.fetchone()
        return dict(row) if row else None


def delete_role(role_id: int) -> dict:
    """Delete a role if it's not in use.

    Returns dict with 'success' and 'error' keys.
    """
    with get_cursor() as cur:
        # Check if role is in use
        cur.execute("SELECT COUNT(*) as count FROM person_roles WHERE role_id = %s", (role_id,))
        count = cur.fetchone()["count"]
        if count > 0:
            return {
                "success": False,
                "error": f"Cannot delete role: it is assigned to {count} person(s)"
            }

        cur.execute("DELETE FROM roles WHERE id = %s", (role_id,))
        if cur.rowcount == 0:
            return {"success": False, "error": "Role not found"}

        return {"success": True}


def count_persons_by_role(role_id: int) -> int:
    """Count how many person_roles entries use this role."""
    with get_cursor() as cur:
        cur.execute("SELECT COUNT(*) as count FROM person_roles WHERE role_id = %s", (role_id,))
        return cur.fetchone()["count"]


def get_roles_with_counts() -> List[dict]:
    """Get all roles with their usage counts."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT r.id, r.name, r.category, r.sort_order, r.description, r.created_at,
                   COUNT(pr.id) as usage_count
            FROM roles r
            LEFT JOIN person_roles pr ON r.id = pr.role_id
            GROUP BY r.id, r.name, r.category, r.sort_order, r.description, r.created_at
            ORDER BY r.category, r.sort_order, r.name
        """)
        return serialize_rows([dict(row) for row in cur.fetchall()])
