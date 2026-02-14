"""
Objections management functions.

CRUD operations for legal objections used in RFP responses.
"""

from typing import Optional, List
from datetime import datetime

from sqlalchemy import select

from .session import SessionLocal
from models import Objection


def _objection_to_dict(obj: Objection) -> dict:
    """Convert an Objection ORM instance to a serializable dict."""
    return {
        "id": obj.id,
        "name": obj.name,
        "short_name": obj.short_name,
        "formal_language": obj.formal_language,
        "argument_template": obj.argument_template,
        "ai_notes": obj.ai_notes,
        "position": obj.position,
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
    }


def get_objections() -> List[dict]:
    """Get all objections ordered by position."""
    with SessionLocal() as session:
        stmt = select(Objection).order_by(Objection.position, Objection.id)
        objections = session.scalars(stmt).all()
        return [_objection_to_dict(o) for o in objections]


def get_objection_by_id(objection_id: int) -> Optional[dict]:
    """Get a single objection by ID."""
    with SessionLocal() as session:
        obj = session.get(Objection, objection_id)
        return _objection_to_dict(obj) if obj else None


def create_objection(
    name: str,
    short_name: str,
    formal_language: str,
    argument_template: str = None,
    position: int = 0,
) -> dict:
    """Create a new objection."""
    with SessionLocal() as session:
        obj = Objection(
            name=name,
            short_name=short_name,
            formal_language=formal_language,
            argument_template=argument_template,
            position=position,
        )
        session.add(obj)
        session.flush()
        session.refresh(obj)
        result = _objection_to_dict(obj)
        session.commit()
        return result


def update_objection(objection_id: int, **kwargs) -> Optional[dict]:
    """Update an objection. Pass only the fields to update."""
    allowed = {"name", "short_name", "formal_language", "argument_template", "ai_notes", "position"}
    with SessionLocal() as session:
        obj = session.get(Objection, objection_id)
        if not obj:
            return None

        for key, value in kwargs.items():
            if key in allowed and value is not None:
                setattr(obj, key, value)
        obj.updated_at = datetime.utcnow()

        session.flush()
        session.refresh(obj)
        result = _objection_to_dict(obj)
        session.commit()
        return result


def delete_objection(objection_id: int) -> dict:
    """Delete an objection."""
    with SessionLocal() as session:
        obj = session.get(Objection, objection_id)
        if not obj:
            return {"success": False, "error": "Objection not found"}
        session.delete(obj)
        session.commit()
        return {"success": True}


def reorder_objections(ordered_ids: List[int]) -> List[dict]:
    """Reorder objections by setting position based on the order of IDs."""
    with SessionLocal() as session:
        for position, obj_id in enumerate(ordered_ids):
            obj = session.get(Objection, obj_id)
            if obj:
                obj.position = position
                obj.updated_at = datetime.utcnow()
        session.commit()
        return get_objections()
