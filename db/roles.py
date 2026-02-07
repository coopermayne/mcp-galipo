"""
Roles management functions.

Roles replace the old person_types system, providing categorized role definitions
that can be assigned to persons via the person_roles junction table.
"""

from typing import Optional, List

from sqlalchemy import select, func

from .session import SessionLocal
from .connection import serialize_rows
from .validation import ROLE_CATEGORIES, ValidationError
from models import Role, PersonRole


def _role_to_dict(role: Role) -> dict:
    """Convert a Role ORM instance to a serializable dict."""
    return {
        "id": role.id,
        "name": role.name,
        "category": role.category,
        "sort_order": role.sort_order,
        "description": role.description,
        "created_at": role.created_at.isoformat() if role.created_at else None,
    }


def get_roles(category: str = None) -> List[dict]:
    """Get all roles, optionally filtered by category.

    Categories: 'client', 'counsel', 'defendant', 'expert', 'mediator', 'other'
    """
    with SessionLocal() as session:
        stmt = select(Role)
        if category:
            stmt = stmt.where(Role.category == category).order_by(Role.sort_order, Role.name)
        else:
            stmt = stmt.order_by(Role.category, Role.sort_order, Role.name)
        roles = session.scalars(stmt).all()
        return [_role_to_dict(r) for r in roles]


def get_role_by_id(role_id: int) -> Optional[dict]:
    """Get a single role by ID."""
    with SessionLocal() as session:
        role = session.get(Role, role_id)
        return _role_to_dict(role) if role else None


def get_role_by_name(name: str) -> Optional[dict]:
    """Get a role by name (case-insensitive)."""
    with SessionLocal() as session:
        stmt = select(Role).where(func.lower(Role.name) == func.lower(name))
        role = session.scalars(stmt).first()
        return _role_to_dict(role) if role else None


def create_role(name: str, category: str = "other", sort_order: int = 0,
                description: str = None) -> dict:
    """Create a new role. Category defaults to 'other' for ad-hoc roles."""
    if category not in ROLE_CATEGORIES:
        raise ValidationError(f"Invalid category '{category}'. Must be one of: {ROLE_CATEGORIES}")

    with SessionLocal() as session:
        role = Role(name=name, category=category, sort_order=sort_order, description=description)
        session.add(role)
        session.flush()
        session.refresh(role)
        result = _role_to_dict(role)
        session.commit()
        return result


def update_role(role_id: int, name: str = None, category: str = None,
                sort_order: int = None, description: str = None) -> Optional[dict]:
    """Update a role."""
    if category is not None and category not in ROLE_CATEGORIES:
        raise ValidationError(f"Invalid category '{category}'. Must be one of: {ROLE_CATEGORIES}")

    with SessionLocal() as session:
        role = session.get(Role, role_id)
        if not role:
            return None

        if name is not None:
            role.name = name
        if category is not None:
            role.category = category
        if sort_order is not None:
            role.sort_order = sort_order
        if description is not None:
            role.description = description

        session.flush()
        session.refresh(role)
        result = _role_to_dict(role)
        session.commit()
        return result


def delete_role(role_id: int) -> dict:
    """Delete a role if it's not in use.

    Returns dict with 'success' and 'error' keys.
    """
    with SessionLocal() as session:
        # Check if role is in use
        count = session.scalar(
            select(func.count(PersonRole.id)).where(PersonRole.role_id == role_id)
        )
        if count > 0:
            return {
                "success": False,
                "error": f"Cannot delete role: it is assigned to {count} person(s)"
            }

        role = session.get(Role, role_id)
        if not role:
            return {"success": False, "error": "Role not found"}

        session.delete(role)
        session.commit()
        return {"success": True}


def count_persons_by_role(role_id: int) -> int:
    """Count how many person_roles entries use this role."""
    with SessionLocal() as session:
        return session.scalar(
            select(func.count(PersonRole.id)).where(PersonRole.role_id == role_id)
        )


def get_roles_with_counts() -> List[dict]:
    """Get all roles with their usage counts."""
    with SessionLocal() as session:
        stmt = (
            select(Role, func.count(PersonRole.id).label("usage_count"))
            .outerjoin(PersonRole, Role.id == PersonRole.role_id)
            .group_by(Role.id)
            .order_by(Role.category, Role.sort_order, Role.name)
        )
        rows = session.execute(stmt).all()
        results = []
        for role, usage_count in rows:
            d = _role_to_dict(role)
            d["usage_count"] = usage_count
            results.append(d)
        return results
