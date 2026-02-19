"""
Judges management functions.

Judges are separate from the persons system - they have their own standalone table
and are linked to proceedings (not cases) via the proceeding_judges table.
"""

from typing import Optional, List

from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import joinedload

from .session import SessionLocal, _NOT_PROVIDED
from .fuzzy_match import fuzzy_search_judges as _fuzzy_search
from models import Judge, Jurisdiction, ProceedingJudge, Proceeding, Case
from schemas import JudgeOut, ProceedingJudgeOut


def _judge_to_dict(j: Judge) -> dict:
    """Convert a Judge ORM instance to a serializable dict."""
    d = JudgeOut.model_validate(j).model_dump(mode="json")
    d["phones"] = j.phones or []
    d["emails"] = j.emails or []
    d["jurisdiction_name"] = j.jurisdiction.name if j.jurisdiction else None
    return d


def _judge_with_rules_to_dict(j: Judge) -> dict:
    """Like _judge_to_dict but includes local_rules_link."""
    d = _judge_to_dict(j)
    d["local_rules_link"] = j.jurisdiction.local_rules_link if j.jurisdiction else None
    return d


def _proceeding_judge_to_dict(pj: ProceedingJudge) -> dict:
    """Convert a ProceedingJudge ORM instance to a serializable dict."""
    return ProceedingJudgeOut(
        id=pj.id,
        proceeding_id=pj.proceeding_id,
        judge_id=pj.judge_id,
        role=pj.role,
        sort_order=pj.sort_order,
        created_at=pj.created_at,
        name=pj.judge.name if pj.judge else None,
        judge_name=pj.judge.name if pj.judge else None,
        jurisdiction_id=pj.judge.jurisdiction_id if pj.judge else None,
        jurisdiction_name=(
            pj.judge.jurisdiction.name
            if pj.judge and pj.judge.jurisdiction else None
        ),
    ).model_dump(mode="json")


def get_judges(search: str = None, jurisdiction_id: int = None,
               status: str = None, title: str = None,
               limit: int = 50, offset: int = 0) -> dict:
    """Get all judges with optional filtering."""
    with SessionLocal() as session:
        # Build conditions
        conditions = []
        if search:
            conditions.append(Judge.name.ilike(f"%{search}%"))
        if jurisdiction_id:
            conditions.append(Judge.jurisdiction_id == jurisdiction_id)
        if status:
            conditions.append(Judge.status == status)
        if title:
            conditions.append(Judge.title == title)

        # Count
        count_stmt = select(func.count(Judge.id))
        for cond in conditions:
            count_stmt = count_stmt.where(cond)
        total = session.scalar(count_stmt)

        # Fetch judges
        stmt = (
            select(Judge)
            .options(joinedload(Judge.jurisdiction))
            .order_by(Judge.name)
            .limit(limit)
            .offset(offset)
        )
        for cond in conditions:
            stmt = stmt.where(cond)

        judges = [_judge_to_dict(j) for j in session.scalars(stmt).unique().all()]
        return {"judges": judges, "total": total}


def get_judge_by_id(judge_id: int) -> Optional[dict]:
    """Get a single judge by ID with jurisdiction info and proceeding assignments."""
    with SessionLocal() as session:
        stmt = (
            select(Judge)
            .options(joinedload(Judge.jurisdiction))
            .where(Judge.id == judge_id)
        )
        j = session.scalars(stmt).unique().first()
        if not j:
            return None

        result = _judge_with_rules_to_dict(j)

        # Get proceeding assignments
        proc_stmt = (
            select(ProceedingJudge, Proceeding, Case)
            .join(Proceeding, ProceedingJudge.proceeding_id == Proceeding.id)
            .join(Case, Proceeding.case_id == Case.id)
            .where(ProceedingJudge.judge_id == judge_id)
            .order_by(Case.case_name, Proceeding.case_number)
        )
        rows = session.execute(proc_stmt).all()
        result["proceedings"] = [
            {
                "proceeding_id": pj.proceeding_id,
                "role": pj.role,
                "sort_order": pj.sort_order,
                "case_number": p.case_number,
                "case_id": p.case_id,
                "case_name": c.case_name,
                "short_name": c.short_name,
            }
            for pj, p, c in rows
        ]

        return result


def search_judges(name: str = None, jurisdiction_id: int = None) -> List[dict]:
    """Search judges by name and/or jurisdiction. Returns simple list for autocomplete.

    Always uses fuzzy scoring so results are consistently ranked.
    Exact/substring matches naturally score highest.
    """
    with SessionLocal() as session:
        if name:
            return _fuzzy_search(session, name, jurisdiction_id=jurisdiction_id, limit=20)

        # No name filter — return alphabetical list
        stmt = (
            select(Judge)
            .options(joinedload(Judge.jurisdiction))
            .order_by(Judge.name)
            .limit(20)
        )
        if jurisdiction_id:
            stmt = stmt.where(Judge.jurisdiction_id == jurisdiction_id)

        return [
            {
                "id": j.id,
                "name": j.name,
                "title": j.title,
                "jurisdiction_id": j.jurisdiction_id,
                "jurisdiction_name": j.jurisdiction.name if j.jurisdiction else None,
            }
            for j in session.scalars(stmt).unique().all()
        ]


def create_judge(name: str, phones: List[dict] = None, emails: List[dict] = None,
                 jurisdiction_id: int = None, chambers: str = None,
                 courtroom_number: str = None, appointed_by: str = None,
                 appointed_date: str = None, initials: str = None,
                 status: str = "Active", notes: str = None,
                 title: str = None) -> dict:
    """Create a new judge."""
    with SessionLocal() as session:
        j = Judge(
            name=name,
            title=title,
            phones=phones or [],
            emails=emails or [],
            jurisdiction_id=jurisdiction_id,
            chambers=chambers,
            courtroom_number=courtroom_number,
            appointed_by=appointed_by,
            appointed_date=appointed_date,
            initials=initials,
            status=status,
            notes=notes,
        )
        session.add(j)
        session.flush()
        judge_id = j.id
        session.commit()

    # Re-fetch with full data (jurisdiction join, proceedings)
    return get_judge_by_id(judge_id)


def update_judge(judge_id: int, name: str = _NOT_PROVIDED,
                 phones: List[dict] = _NOT_PROVIDED, emails: List[dict] = _NOT_PROVIDED,
                 jurisdiction_id: int = _NOT_PROVIDED, chambers: str = _NOT_PROVIDED,
                 courtroom_number: str = _NOT_PROVIDED, appointed_by: str = _NOT_PROVIDED,
                 appointed_date: str = _NOT_PROVIDED, initials: str = _NOT_PROVIDED,
                 status: str = _NOT_PROVIDED, notes: str = _NOT_PROVIDED,
                 title: str = _NOT_PROVIDED) -> Optional[dict]:
    """Update a judge."""
    with SessionLocal() as session:
        j = session.get(Judge, judge_id)
        if not j:
            return None

        if name is not _NOT_PROVIDED:
            j.name = name
        if title is not _NOT_PROVIDED:
            j.title = title
        if phones is not _NOT_PROVIDED:
            j.phones = phones or []
        if emails is not _NOT_PROVIDED:
            j.emails = emails or []
        if jurisdiction_id is not _NOT_PROVIDED:
            j.jurisdiction_id = jurisdiction_id
        if chambers is not _NOT_PROVIDED:
            j.chambers = chambers
        if courtroom_number is not _NOT_PROVIDED:
            j.courtroom_number = courtroom_number
        if appointed_by is not _NOT_PROVIDED:
            j.appointed_by = appointed_by
        if appointed_date is not _NOT_PROVIDED:
            j.appointed_date = appointed_date
        if initials is not _NOT_PROVIDED:
            j.initials = initials
        if status is not _NOT_PROVIDED:
            j.status = status
        if notes is not _NOT_PROVIDED:
            j.notes = notes

        j.updated_at = func.now()
        session.commit()

    return get_judge_by_id(judge_id)


def delete_judge(judge_id: int) -> dict:
    """Delete a judge if not assigned to any proceedings.

    Returns dict with 'success' and 'error' keys.
    """
    with SessionLocal() as session:
        # Check if judge is assigned to any proceedings
        count = session.scalar(
            select(func.count(ProceedingJudge.id))
            .where(ProceedingJudge.judge_id == judge_id)
        )
        if count > 0:
            return {
                "success": False,
                "error": f"Cannot delete judge: assigned to {count} proceeding(s)"
            }

        j = session.get(Judge, judge_id)
        if not j:
            return {"success": False, "error": "Judge not found"}

        session.delete(j)
        session.commit()
        return {"success": True}


# ============================================================================
# Proceeding-Judge Junction Table Operations
# ============================================================================

def add_judge_to_proceeding(proceeding_id: int, judge_id: int, role: str = "Judge",
                            sort_order: int = None) -> dict:
    """Add a judge to a proceeding."""
    with SessionLocal() as session:
        # Determine sort_order if not provided
        if sort_order is None:
            max_order = session.scalar(
                select(func.coalesce(func.max(ProceedingJudge.sort_order), 0))
                .where(ProceedingJudge.proceeding_id == proceeding_id)
            )
            sort_order = max_order + 1

        # PostgreSQL upsert
        stmt = (
            pg_insert(ProceedingJudge)
            .values(
                proceeding_id=proceeding_id,
                judge_id=judge_id,
                role=role,
                sort_order=sort_order,
            )
            .on_conflict_do_update(
                constraint="proceeding_judges_proceeding_id_judge_id_key",
                set_={"role": role, "sort_order": sort_order},
            )
            .returning(
                ProceedingJudge.id,
                ProceedingJudge.proceeding_id,
                ProceedingJudge.judge_id,
                ProceedingJudge.role,
                ProceedingJudge.sort_order,
                ProceedingJudge.created_at,
            )
        )
        row = session.execute(stmt).mappings().first()

        # Get judge name
        judge = session.get(Judge, judge_id)
        result = {
            "id": row["id"],
            "proceeding_id": row["proceeding_id"],
            "judge_id": row["judge_id"],
            "role": row["role"],
            "sort_order": row["sort_order"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "name": judge.name if judge else None,
        }
        session.commit()
        return result


def remove_judge_from_proceeding(proceeding_id: int, judge_id: int) -> bool:
    """Remove a judge from a proceeding."""
    with SessionLocal() as session:
        stmt = (
            select(ProceedingJudge)
            .where(
                ProceedingJudge.proceeding_id == proceeding_id,
                ProceedingJudge.judge_id == judge_id,
            )
        )
        pj = session.scalars(stmt).first()
        if not pj:
            return False
        session.delete(pj)
        session.commit()
        return True


def get_proceeding_judges(proceeding_id: int) -> List[dict]:
    """Get all judges for a proceeding."""
    with SessionLocal() as session:
        stmt = (
            select(ProceedingJudge)
            .options(
                joinedload(ProceedingJudge.judge).joinedload(Judge.jurisdiction)
            )
            .where(ProceedingJudge.proceeding_id == proceeding_id)
            .order_by(ProceedingJudge.sort_order, ProceedingJudge.id)
        )
        rows = session.scalars(stmt).unique().all()
        return [_proceeding_judge_to_dict(pj) for pj in rows]


def update_proceeding_judge(proceeding_id: int, judge_id: int, role: str = _NOT_PROVIDED,
                            sort_order: int = _NOT_PROVIDED) -> Optional[dict]:
    """Update a judge's role or sort_order on a proceeding."""
    with SessionLocal() as session:
        stmt = (
            select(ProceedingJudge)
            .options(
                joinedload(ProceedingJudge.judge).joinedload(Judge.jurisdiction)
            )
            .where(
                ProceedingJudge.proceeding_id == proceeding_id,
                ProceedingJudge.judge_id == judge_id,
            )
        )
        pj = session.scalars(stmt).unique().first()
        if not pj:
            return None

        if role is not _NOT_PROVIDED:
            pj.role = role
        if sort_order is not _NOT_PROVIDED:
            pj.sort_order = sort_order

        session.flush()
        session.refresh(pj)
        result = _proceeding_judge_to_dict(pj)
        session.commit()
        return result
