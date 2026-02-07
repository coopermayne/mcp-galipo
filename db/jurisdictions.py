"""
Jurisdiction CRUD operations.
"""

from typing import Optional, List

from sqlalchemy import select

from .session import SessionLocal
from models import Jurisdiction


def _jurisdiction_to_dict(j: Jurisdiction) -> dict:
    """Convert a Jurisdiction ORM instance to a serializable dict."""
    return {
        "id": j.id,
        "name": j.name,
        "local_rules_link": j.local_rules_link,
        "notes": j.notes,
    }


def get_jurisdictions() -> List[dict]:
    """Get all jurisdictions."""
    with SessionLocal() as session:
        stmt = select(Jurisdiction).order_by(Jurisdiction.name)
        return [_jurisdiction_to_dict(j) for j in session.scalars(stmt).all()]


def get_jurisdiction_by_id(jurisdiction_id: int) -> Optional[dict]:
    """Get a jurisdiction by ID."""
    with SessionLocal() as session:
        j = session.get(Jurisdiction, jurisdiction_id)
        return _jurisdiction_to_dict(j) if j else None


def get_jurisdiction_by_name(name: str) -> Optional[dict]:
    """Get a jurisdiction by name."""
    with SessionLocal() as session:
        stmt = select(Jurisdiction).where(Jurisdiction.name == name)
        j = session.scalars(stmt).first()
        return _jurisdiction_to_dict(j) if j else None


def create_jurisdiction(name: str, local_rules_link: str = None, notes: str = None) -> dict:
    """Create a new jurisdiction."""
    with SessionLocal() as session:
        j = Jurisdiction(name=name, local_rules_link=local_rules_link, notes=notes)
        session.add(j)
        session.flush()
        session.refresh(j)
        result = _jurisdiction_to_dict(j)
        session.commit()
        return result


def update_jurisdiction(jurisdiction_id: int, name: str = None,
                        local_rules_link: str = None, notes: str = None) -> Optional[dict]:
    """Update a jurisdiction."""
    with SessionLocal() as session:
        j = session.get(Jurisdiction, jurisdiction_id)
        if not j:
            return None

        if name is not None:
            j.name = name
        if local_rules_link is not None:
            j.local_rules_link = local_rules_link
        if notes is not None:
            j.notes = notes

        session.flush()
        session.refresh(j)
        result = _jurisdiction_to_dict(j)
        session.commit()
        return result


def delete_jurisdiction(jurisdiction_id: int) -> bool:
    """Delete a jurisdiction. Will fail if proceedings are still referencing it."""
    with SessionLocal() as session:
        j = session.get(Jurisdiction, jurisdiction_id)
        if not j:
            return False
        session.delete(j)
        session.commit()
        return True
