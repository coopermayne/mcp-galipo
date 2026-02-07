"""
Proceedings management functions.

A proceeding represents a court filing within a case. A single case (matter) can have
multiple proceedings across different courts (e.g., state court -> federal removal -> appeal).

Judges are now standalone entities (not persons) linked via the proceeding_judges table.
Use db/judges.py for judge management.
"""

from typing import Optional, List

from sqlalchemy import select, func
from sqlalchemy.orm import joinedload

from .session import SessionLocal, _NOT_PROVIDED
from models import Proceeding, Jurisdiction, ProceedingJudge, Judge
from schemas import ProceedingOut


def _proceeding_to_dict(p: Proceeding, judges_list: list = None) -> dict:
    """Convert a Proceeding ORM instance to a serializable dict."""
    judges = judges_list if judges_list is not None else []
    return ProceedingOut(
        id=p.id,
        case_id=p.case_id,
        case_number=p.case_number,
        jurisdiction_id=p.jurisdiction_id,
        sort_order=p.sort_order,
        is_primary=p.is_primary,
        notes=p.notes,
        courtlistener_docket_id=p.courtlistener_docket_id,
        pacer_case_id=p.pacer_case_id,
        created_at=p.created_at,
        updated_at=p.updated_at,
        jurisdiction_name=p.jurisdiction.name if p.jurisdiction else None,
        local_rules_link=p.jurisdiction.local_rules_link if p.jurisdiction else None,
        judges=judges,
        judge_name=judges[0].get("name") if judges else None,
        judge_id=judges[0].get("judge_id") if judges else None,
    ).model_dump(mode="json")


def _fetch_judges_for_proceedings(session, proceeding_ids: List[int]) -> dict:
    """Fetch all judges for a set of proceeding IDs, grouped by proceeding_id."""
    if not proceeding_ids:
        return {}

    stmt = (
        select(ProceedingJudge, Judge)
        .join(Judge, ProceedingJudge.judge_id == Judge.id)
        .where(ProceedingJudge.proceeding_id.in_(proceeding_ids))
        .order_by(ProceedingJudge.sort_order, ProceedingJudge.id)
    )
    rows = session.execute(stmt).all()

    judges_by_proceeding = {}
    for pj, judge in rows:
        pid = pj.proceeding_id
        if pid not in judges_by_proceeding:
            judges_by_proceeding[pid] = []
        judges_by_proceeding[pid].append({
            "judge_id": pj.judge_id,
            "name": judge.name,
            "role": pj.role,
            "sort_order": pj.sort_order,
        })

    return judges_by_proceeding


def add_proceeding(case_id: int, case_number: str, jurisdiction_id: int = None,
                   sort_order: int = None, is_primary: bool = False,
                   notes: str = None, courtlistener_docket_id: int = None,
                   pacer_case_id: str = None) -> dict:
    """Add a proceeding to a case."""
    with SessionLocal() as session:
        # Count existing and determine sort_order
        row = session.execute(
            select(
                func.count(Proceeding.id).label("count"),
                func.coalesce(func.max(Proceeding.sort_order), 0).label("max_order"),
            ).where(Proceeding.case_id == case_id)
        ).one()

        if sort_order is None:
            sort_order = row.max_order + 1

        # Auto-set as primary if this is the first proceeding for the case
        if row.count == 0:
            is_primary = True

        # If this is marked as primary, unmark others
        if is_primary:
            session.execute(
                Proceeding.__table__.update()
                .where(Proceeding.case_id == case_id)
                .values(is_primary=False)
            )

        p = Proceeding(
            case_id=case_id,
            case_number=case_number,
            jurisdiction_id=jurisdiction_id,
            sort_order=sort_order,
            is_primary=is_primary,
            notes=notes,
            courtlistener_docket_id=courtlistener_docket_id,
            pacer_case_id=pacer_case_id,
        )
        session.add(p)
        session.flush()
        session.refresh(p)

        # Eagerly load jurisdiction if present
        if jurisdiction_id:
            session.refresh(p, attribute_names=["jurisdiction"])

        result = _proceeding_to_dict(p, judges_list=[])
        session.commit()
        return result


def get_proceedings(case_id: int) -> List[dict]:
    """Get all proceedings for a case with their judges."""
    with SessionLocal() as session:
        stmt = (
            select(Proceeding)
            .options(joinedload(Proceeding.jurisdiction))
            .where(Proceeding.case_id == case_id)
            .order_by(Proceeding.sort_order, Proceeding.id)
        )
        proceedings = session.scalars(stmt).unique().all()

        # Fetch judges for all proceedings in one query
        proceeding_ids = [p.id for p in proceedings]
        judges_by_proceeding = _fetch_judges_for_proceedings(session, proceeding_ids)

        return [
            _proceeding_to_dict(p, judges_by_proceeding.get(p.id, []))
            for p in proceedings
        ]


def get_proceeding_by_id(proceeding_id: int) -> Optional[dict]:
    """Get a proceeding by ID with joined jurisdiction and judge data."""
    with SessionLocal() as session:
        stmt = (
            select(Proceeding)
            .options(joinedload(Proceeding.jurisdiction))
            .where(Proceeding.id == proceeding_id)
        )
        p = session.scalars(stmt).unique().first()
        if not p:
            return None

        judges_by_proceeding = _fetch_judges_for_proceedings(session, [p.id])
        return _proceeding_to_dict(p, judges_by_proceeding.get(p.id, []))


def update_proceeding(proceeding_id: int, case_number: str = _NOT_PROVIDED,
                      jurisdiction_id: int = _NOT_PROVIDED,
                      sort_order: int = _NOT_PROVIDED, is_primary: bool = _NOT_PROVIDED,
                      notes: str = _NOT_PROVIDED, courtlistener_docket_id: int = _NOT_PROVIDED,
                      pacer_case_id: str = _NOT_PROVIDED) -> Optional[dict]:
    """Update a proceeding."""
    with SessionLocal() as session:
        p = session.get(Proceeding, proceeding_id)
        if not p:
            return None

        # If setting as primary, unmark others first
        if is_primary is not _NOT_PROVIDED and is_primary:
            session.execute(
                Proceeding.__table__.update()
                .where(Proceeding.case_id == p.case_id, Proceeding.id != proceeding_id)
                .values(is_primary=False)
            )

        if case_number is not _NOT_PROVIDED:
            p.case_number = case_number
        if jurisdiction_id is not _NOT_PROVIDED:
            p.jurisdiction_id = jurisdiction_id
        if sort_order is not _NOT_PROVIDED:
            p.sort_order = sort_order
        if is_primary is not _NOT_PROVIDED:
            p.is_primary = is_primary
        if notes is not _NOT_PROVIDED:
            p.notes = notes if notes else None
        if courtlistener_docket_id is not _NOT_PROVIDED:
            p.courtlistener_docket_id = courtlistener_docket_id
        if pacer_case_id is not _NOT_PROVIDED:
            p.pacer_case_id = pacer_case_id

        p.updated_at = func.now()
        session.commit()

    return get_proceeding_by_id(proceeding_id)


def delete_proceeding(proceeding_id: int) -> bool:
    """Delete a proceeding (cascade deletes proceeding_judges).

    If only one proceeding remains after deletion, it becomes primary automatically.
    """
    with SessionLocal() as session:
        p = session.get(Proceeding, proceeding_id)
        if not p:
            return False

        case_id = p.case_id
        session.delete(p)
        session.flush()

        # If only one proceeding remains, make it primary
        remaining = session.scalars(
            select(Proceeding).where(Proceeding.case_id == case_id)
        ).all()
        if len(remaining) == 1:
            remaining[0].is_primary = True

        session.commit()
        return True


# ============================================================================
# CourtListener Integration
# ============================================================================

def get_proceeding_by_courtlistener_docket_id(docket_id: int) -> Optional[dict]:
    """Find a proceeding by its CourtListener docket ID."""
    with SessionLocal() as session:
        stmt = select(Proceeding.id).where(Proceeding.courtlistener_docket_id == docket_id)
        pid = session.scalar(stmt)
        if pid:
            return get_proceeding_by_id(pid)
        return None


def get_proceeding_by_pacer_case_id(pacer_case_id: str) -> Optional[dict]:
    """Find a proceeding by its PACER case ID (e.g., 'gov.uscourts.cacd.980378')."""
    with SessionLocal() as session:
        stmt = select(Proceeding.id).where(Proceeding.pacer_case_id == pacer_case_id)
        pid = session.scalar(stmt)
        if pid:
            return get_proceeding_by_id(pid)
        return None


def find_proceeding_for_webhook(docket_id: int = None, pacer_case_id: str = None) -> Optional[dict]:
    """
    Find a proceeding matching CourtListener webhook data.

    Tries to match by:
    1. CourtListener docket ID (exact match, most reliable)
    2. PACER case ID (fallback)

    Returns the proceeding if found, None otherwise.
    """
    # Try CourtListener docket ID first (most reliable)
    if docket_id:
        proceeding = get_proceeding_by_courtlistener_docket_id(docket_id)
        if proceeding:
            return proceeding

    # Fall back to PACER case ID
    if pacer_case_id:
        proceeding = get_proceeding_by_pacer_case_id(pacer_case_id)
        if proceeding:
            return proceeding

    return None
