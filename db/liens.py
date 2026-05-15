"""Lien management functions — SQLAlchemy ORM implementation."""

import datetime
import os
from typing import Optional

from sqlalchemy import select, func

from .session import SessionLocal
from .feature_gates import (
    FEATURE_COSTS, feature_enabled_filter, require_feature_for_case,
    is_feature_enabled,
)
from models import Lien, Case, CaseComment, Payee


def _lien_to_dict(
    lien: Lien,
    case_name: str = None,
    payee_name: str = None,
    payee_address: str = None,
) -> dict:
    return {
        "id": lien.id,
        "case_id": lien.case_id,
        "case_name": case_name,
        "payee_id": lien.payee_id,
        "payee_name": payee_name,
        "payee_address": payee_address,
        "description": lien.description,
        "claimed_amount": str(lien.claimed_amount) if lien.claimed_amount is not None else None,
        "negotiated_amount": str(lien.negotiated_amount) if lien.negotiated_amount is not None else None,
        "status": lien.status,
        "date": lien.date.isoformat() if lien.date else None,
        "paid_date": lien.paid_date.isoformat() if lien.paid_date else None,
        "check_number": lien.check_number,
        "file_path": lien.file_path,
        "file_name": lien.file_name,
        "content_type": lien.content_type,
        "notes": lien.notes,
        "created_at": lien.created_at.isoformat() if lien.created_at else None,
        "updated_at": lien.updated_at.isoformat() if lien.updated_at else None,
    }


def list_liens(
    case_id: int = None,
    status: str = None,
    search: str = None,
    sort_by: str = "date",
    sort_dir: str = "desc",
    limit: int = 100,
    offset: int = 0,
) -> dict:
    stmt = (
        select(
            Lien,
            Case.case_name,
            Payee.name.label("payee_name"),
            Payee.address.label("payee_address"),
        )
        .join(Case, Lien.case_id == Case.id)
        .outerjoin(Payee, Lien.payee_id == Payee.id)
    )

    stmt = stmt.where(feature_enabled_filter(FEATURE_COSTS, Lien.case_id))
    if case_id:
        stmt = stmt.where(Lien.case_id == case_id)
    if status:
        stmt = stmt.where(Lien.status == status)
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            Payee.name.ilike(pattern)
            | Lien.description.ilike(pattern)
        )

    sort_col = {
        "date": Lien.date,
        "claimed_amount": Lien.claimed_amount,
        "negotiated_amount": Lien.negotiated_amount,
        "payee": Payee.name,
        "status": Lien.status,
        "created_at": Lien.created_at,
    }.get(sort_by, Lien.date)

    if sort_dir == "desc":
        stmt = stmt.order_by(sort_col.desc().nullslast(), Lien.created_at.desc())
    else:
        stmt = stmt.order_by(sort_col.asc().nullslast(), Lien.created_at.asc())

    feature_clause = feature_enabled_filter(FEATURE_COSTS, Lien.case_id)
    count_inner = select(Lien.id).where(feature_clause)
    if case_id:
        count_inner = count_inner.where(Lien.case_id == case_id)
    if status:
        count_inner = count_inner.where(Lien.status == status)
    count_stmt = select(func.count()).select_from(count_inner.subquery())

    with SessionLocal() as session:
        total = session.scalar(count_stmt)
        rows = session.execute(stmt.limit(limit).offset(offset)).all()
        liens = [
            _lien_to_dict(lien, case_name, payee_name, payee_addr)
            for lien, case_name, payee_name, payee_addr in rows
        ]
        return {"liens": liens, "total": total}


def get_lien(lien_id: int) -> Optional[dict]:
    with SessionLocal() as session:
        row = session.execute(
            select(
                Lien,
                Case.case_name,
                Payee.name.label("payee_name"),
                Payee.address.label("payee_address"),
            )
            .join(Case, Lien.case_id == Case.id)
            .outerjoin(Payee, Lien.payee_id == Payee.id)
            .where(Lien.id == lien_id)
        ).first()
        if not row:
            return None
        lien, case_name, payee_name, payee_addr = row
        if not is_feature_enabled(session, lien.case_id, FEATURE_COSTS):
            return None
        return _lien_to_dict(lien, case_name, payee_name, payee_addr)


def create_lien(
    case_id: int,
    claimed_amount: float,
    payee_id: int = None,
    negotiated_amount: float = None,
    status: str = "pending",
    date: str = None,
    paid_date: str = None,
    check_number: str = None,
    description: str = None,
    file_path: str = None,
    file_name: str = None,
    content_type: str = None,
    notes: str = None,
) -> dict:
    with SessionLocal() as session:
        require_feature_for_case(session, case_id, FEATURE_COSTS)
        lien = Lien(
            case_id=case_id,
            payee_id=payee_id,
            claimed_amount=claimed_amount,
            negotiated_amount=negotiated_amount,
            status=status,
            date=date,
            paid_date=paid_date,
            check_number=check_number,
            description=description,
            file_path=file_path,
            file_name=file_name,
            content_type=content_type,
            notes=notes,
        )
        session.add(lien)
        session.flush()

        case = session.get(Case, case_id)
        case_name = case.case_name if case else None

        payee_name = None
        payee_address = None
        if payee_id:
            payee = session.get(Payee, payee_id)
            if payee:
                payee_name = payee.name
                payee_address = payee.address

        comment_payee = payee_name or "unknown lien holder"
        comment = CaseComment(
            case_id=case_id,
            content=f"Lien added: ${claimed_amount:,.2f} from {comment_payee}",
            is_system=True,
        )
        session.add(comment)

        session.refresh(lien)
        result = _lien_to_dict(lien, case_name, payee_name, payee_address)
        session.commit()
        return result


def update_lien(lien_id: int, **fields) -> Optional[dict]:
    with SessionLocal() as session:
        lien = session.get(Lien, lien_id)
        if not lien:
            return None
        require_feature_for_case(session, lien.case_id, FEATURE_COSTS)

        for key, value in fields.items():
            if hasattr(lien, key):
                setattr(lien, key, value)
        lien.updated_at = datetime.datetime.now(datetime.timezone.utc)

        session.flush()
        session.refresh(lien)

        case = session.get(Case, lien.case_id)
        case_name = case.case_name if case else None
        payee_name = None
        payee_address = None
        if lien.payee_id:
            payee = session.get(Payee, lien.payee_id)
            if payee:
                payee_name = payee.name
                payee_address = payee.address
        result = _lien_to_dict(lien, case_name, payee_name, payee_address)
        session.commit()
        return result


def delete_lien(lien_id: int) -> bool:
    with SessionLocal() as session:
        lien = session.get(Lien, lien_id)
        if not lien:
            return False
        require_feature_for_case(session, lien.case_id, FEATURE_COSTS)

        if lien.file_path and os.path.isfile(lien.file_path):
            try:
                os.remove(lien.file_path)
            except OSError:
                pass

        session.delete(lien)
        session.commit()
        return True


def get_lien_stats(case_id: int) -> dict:
    with SessionLocal() as session:
        if not is_feature_enabled(session, case_id, FEATURE_COSTS):
            return {
                "count": 0, "pending_count": 0, "negotiated_count": 0,
                "paid_count": 0, "total_claimed": 0, "total_negotiated": 0,
                "total_paid": 0, "savings": 0, "savings_pct": 0,
            }
        row = session.execute(
            select(
                func.count().label("count"),
                func.count().filter(Lien.status == "pending").label("pending_count"),
                func.count().filter(Lien.status == "negotiated").label("negotiated_count"),
                func.count().filter(Lien.status == "paid").label("paid_count"),
                func.coalesce(func.sum(Lien.claimed_amount), 0).label("total_claimed"),
                func.coalesce(
                    func.sum(Lien.negotiated_amount).filter(
                        Lien.status.in_(["negotiated", "paid"])
                    ),
                    0,
                ).label("total_negotiated"),
                func.coalesce(
                    func.sum(Lien.negotiated_amount).filter(Lien.status == "paid"),
                    0,
                ).label("total_paid"),
            ).where(Lien.case_id == case_id)
        ).first()

        total_claimed = float(row.total_claimed)
        total_negotiated = float(row.total_negotiated)
        savings = total_claimed - total_negotiated if total_negotiated > 0 else 0
        savings_pct = (savings / total_claimed * 100) if total_claimed > 0 and total_negotiated > 0 else 0

        return {
            "count": row.count,
            "pending_count": row.pending_count,
            "negotiated_count": row.negotiated_count,
            "paid_count": row.paid_count,
            "total_claimed": round(total_claimed, 2),
            "total_negotiated": round(total_negotiated, 2),
            "total_paid": round(float(row.total_paid), 2),
            "savings": round(savings, 2),
            "savings_pct": round(savings_pct, 1),
        }
