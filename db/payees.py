"""Payee management functions — SQLAlchemy ORM implementation."""

import datetime
import os
from typing import Optional

from sqlalchemy import select, func

from .session import SessionLocal
from models import Payee


def _payee_to_dict(p: Payee) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "check_name": p.check_name,
        "address": p.address,
        "w9_file_path": p.w9_file_path,
        "w9_file_name": p.w9_file_name,
        "w9_year": p.w9_year,
        "notes": p.notes,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


def list_payees(
    search: str = None,
    limit: int = 100,
    offset: int = 0,
) -> dict:
    stmt = select(Payee)

    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            Payee.name.ilike(pattern)
            | Payee.address.ilike(pattern)
            | Payee.notes.ilike(pattern)
        )

    stmt = stmt.order_by(Payee.name.asc())

    count_stmt = select(func.count()).select_from(Payee)
    if search:
        pattern = f"%{search}%"
        count_stmt = select(func.count()).select_from(
            select(Payee.id).where(
                Payee.name.ilike(pattern)
                | Payee.address.ilike(pattern)
                | Payee.notes.ilike(pattern)
            )
        )

    with SessionLocal() as session:
        total = session.scalar(count_stmt)
        rows = session.execute(stmt.limit(limit).offset(offset)).scalars().all()
        payees = [_payee_to_dict(p) for p in rows]
        return {"payees": payees, "total": total}


def get_payee(payee_id: int) -> Optional[dict]:
    with SessionLocal() as session:
        p = session.get(Payee, payee_id)
        if not p:
            return None
        return _payee_to_dict(p)


def create_payee(
    name: str,
    check_name: str = None,
    address: str = None,
    w9_file_path: str = None,
    w9_file_name: str = None,
    w9_year: int = None,
    notes: str = None,
) -> dict:
    with SessionLocal() as session:
        p = Payee(
            name=name,
            check_name=check_name,
            address=address,
            w9_file_path=w9_file_path,
            w9_file_name=w9_file_name,
            w9_year=w9_year,
            notes=notes,
        )
        session.add(p)
        session.flush()
        session.refresh(p)
        result = _payee_to_dict(p)
        session.commit()
        return result


def update_payee(payee_id: int, **fields) -> Optional[dict]:
    with SessionLocal() as session:
        p = session.get(Payee, payee_id)
        if not p:
            return None

        for key, value in fields.items():
            if hasattr(p, key):
                setattr(p, key, value)
        p.updated_at = datetime.datetime.now(datetime.timezone.utc)

        session.flush()
        session.refresh(p)
        result = _payee_to_dict(p)
        session.commit()
        return result


def delete_payee(payee_id: int) -> bool:
    with SessionLocal() as session:
        p = session.get(Payee, payee_id)
        if not p:
            return False

        if p.w9_file_path and os.path.isfile(p.w9_file_path):
            try:
                os.remove(p.w9_file_path)
            except OSError:
                pass

        session.delete(p)
        session.commit()
        return True


def search_payees(name: str, limit: int = 10) -> list[dict]:
    pattern = f"%{name}%"
    stmt = (
        select(Payee)
        .where(Payee.name.ilike(pattern))
        .order_by(Payee.name.asc())
        .limit(limit)
    )

    with SessionLocal() as session:
        rows = session.execute(stmt).scalars().all()
        return [_payee_to_dict(p) for p in rows]
