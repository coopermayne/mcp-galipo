"""
Expertise types functions.

Note: Person types have been replaced by the unified roles system.
Use db/roles.py for role management.
"""

from typing import Optional, List

from sqlalchemy import select, text

from .session import SessionLocal
from models import ExpertiseType


def _etype_to_dict(et: ExpertiseType) -> dict:
    """Convert an ExpertiseType ORM instance to a serializable dict."""
    return {
        "id": et.id,
        "name": et.name,
        "description": et.description,
    }


# ===== EXPERTISE TYPE OPERATIONS =====

def get_expertise_types() -> List[dict]:
    """Get all expertise types."""
    with SessionLocal() as session:
        stmt = select(ExpertiseType).order_by(ExpertiseType.name)
        return [_etype_to_dict(et) for et in session.scalars(stmt).all()]


def create_expertise_type(name: str, description: str = None) -> dict:
    """Create a new expertise type."""
    with SessionLocal() as session:
        et = ExpertiseType(name=name, description=description)
        session.add(et)
        session.flush()
        session.refresh(et)
        result = _etype_to_dict(et)
        session.commit()
        return result


def get_expertise_type_by_id(expertise_type_id: int) -> Optional[dict]:
    """Get an expertise type by ID."""
    with SessionLocal() as session:
        et = session.get(ExpertiseType, expertise_type_id)
        return _etype_to_dict(et) if et else None


def update_expertise_type(expertise_type_id: int, name: str = None, description: str = None) -> Optional[dict]:
    """Update an expertise type."""
    with SessionLocal() as session:
        et = session.get(ExpertiseType, expertise_type_id)
        if not et:
            return None

        if name is not None:
            et.name = name
        if description is not None:
            et.description = description

        session.flush()
        session.refresh(et)
        result = _etype_to_dict(et)
        session.commit()
        return result


def delete_expertise_type(expertise_type_id: int) -> dict:
    """Delete an expertise type if it's not referenced by any experts.

    Returns dict with 'success' and optional 'error' keys.
    """
    with SessionLocal() as session:
        et = session.get(ExpertiseType, expertise_type_id)
        if not et:
            return {"success": False, "error": "Expertise type not found"}

        name = et.name

        # Check if any person_roles reference this expertise in their attributes
        count = session.scalar(
            text("SELECT COUNT(*) FROM person_roles WHERE attributes->'expertises' ? :name"),
            {"name": name}
        )
        if count > 0:
            return {
                "success": False,
                "error": f"Cannot delete '{name}': it is assigned to {count} expert(s)"
            }

        session.delete(et)
        session.commit()
        return {"success": True}
