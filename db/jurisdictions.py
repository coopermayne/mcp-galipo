"""
Jurisdiction CRUD operations.
"""

from typing import Optional, List

from sqlalchemy import select, func

from .connection import _NOT_PROVIDED
from .session import SessionLocal
from models import Jurisdiction, Judge, Proceeding
from schemas import JurisdictionOut


def _jurisdiction_to_dict(j: Jurisdiction, judge_count: int = 0, proceeding_count: int = 0) -> dict:
    """Convert a Jurisdiction ORM instance to a serializable dict."""
    d = JurisdictionOut.model_validate(j).model_dump(mode="json")
    d["judge_count"] = judge_count
    d["proceeding_count"] = proceeding_count
    return d


def get_jurisdictions() -> List[dict]:
    """Get all jurisdictions with linked entity counts."""
    with SessionLocal() as session:
        judge_count = func.count(Judge.id).label("judge_count")
        proceeding_count = func.count(Proceeding.id).label("proceeding_count")
        stmt = (
            select(Jurisdiction, judge_count, proceeding_count)
            .outerjoin(Judge, Judge.jurisdiction_id == Jurisdiction.id)
            .outerjoin(Proceeding, Proceeding.jurisdiction_id == Jurisdiction.id)
            .group_by(Jurisdiction.id)
            .order_by(Jurisdiction.name)
        )
        results = session.execute(stmt).all()
        return [_jurisdiction_to_dict(j, jc, pc) for j, jc, pc in results]


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


def create_jurisdiction(name: str, local_rules_link: str = None, notes: str = None,
                        aliases: list = None) -> dict:
    """Create a new jurisdiction."""
    with SessionLocal() as session:
        j = Jurisdiction(name=name, local_rules_link=local_rules_link, notes=notes)
        if aliases is not None:
            j.aliases = aliases
        session.add(j)
        session.flush()
        session.refresh(j)
        result = _jurisdiction_to_dict(j)
        session.commit()
        return result


def update_jurisdiction(jurisdiction_id: int, name=_NOT_PROVIDED,
                        local_rules_link=_NOT_PROVIDED, notes=_NOT_PROVIDED,
                        aliases=_NOT_PROVIDED) -> Optional[dict]:
    """Update a jurisdiction.

    Uses the _NOT_PROVIDED sentinel so callers can explicitly clear nullable
    fields (local_rules_link, notes) by passing None.
    """
    with SessionLocal() as session:
        j = session.get(Jurisdiction, jurisdiction_id)
        if not j:
            return None

        if name is not _NOT_PROVIDED and name is not None:
            j.name = name
        if local_rules_link is not _NOT_PROVIDED:
            j.local_rules_link = local_rules_link or None
        if notes is not _NOT_PROVIDED:
            j.notes = notes or None
        if aliases is not _NOT_PROVIDED and aliases is not None:
            j.aliases = aliases

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
