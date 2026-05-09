"""Invoice management functions — SQLAlchemy ORM implementation."""

import datetime
import os
from pathlib import Path
from typing import Optional

from sqlalchemy import select, func, case as sa_case

from .session import SessionLocal
from models import Invoice, Case, CaseComment, Person, Payee


def _invoice_to_dict(
    inv: Invoice,
    case_name: str = None,
    paid_by_name: str = None,
    payee_name: str = None,
    payee_address: str = None,
) -> dict:
    return {
        "id": inv.id,
        "case_id": inv.case_id,
        "case_name": case_name,
        "status": inv.status,
        "payee_id": inv.payee_id,
        "payee_name": payee_name,
        "payee_address": payee_address,
        "amount": str(inv.amount) if inv.amount is not None else None,
        "case_amount": str(inv.case_amount) if inv.case_amount is not None else None,
        "date": inv.date.isoformat() if inv.date else None,
        "due_date": inv.due_date.isoformat() if inv.due_date else None,
        "description": inv.description,
        "category": inv.category,
        "check_number": inv.check_number,
        "paid_date": inv.paid_date.isoformat() if inv.paid_date else None,
        "file_path": inv.file_path,
        "file_name": inv.file_name,
        "content_type": inv.content_type,
        "paid_by_person_id": inv.paid_by_person_id,
        "paid_by_name": paid_by_name,
        "notes": inv.notes,
        "created_at": inv.created_at.isoformat() if inv.created_at else None,
        "updated_at": inv.updated_at.isoformat() if inv.updated_at else None,
    }


def list_invoices(
    case_id: int = None,
    status: str = None,
    search: str = None,
    sort_by: str = "due_date",
    sort_dir: str = "asc",
    limit: int = 100,
    offset: int = 0,
) -> dict:
    paid_by = Person.__table__.alias("paid_by")
    stmt = (
        select(
            Invoice,
            Case.case_name,
            paid_by.c.name.label("paid_by_name"),
            Payee.name.label("payee_name"),
            Payee.address.label("payee_address"),
        )
        .join(Case, Invoice.case_id == Case.id)
        .outerjoin(paid_by, Invoice.paid_by_person_id == paid_by.c.id)
        .outerjoin(Payee, Invoice.payee_id == Payee.id)
    )

    if case_id:
        stmt = stmt.where(Invoice.case_id == case_id)
    if status:
        stmt = stmt.where(Invoice.status == status)
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            Payee.name.ilike(pattern)
            | Invoice.description.ilike(pattern)
            | Case.case_name.ilike(pattern)
        )

    sort_col = {
        "due_date": Invoice.due_date,
        "date": Invoice.date,
        "amount": Invoice.amount,
        "payee": Payee.name,
        "paid_date": Invoice.paid_date,
        "created_at": Invoice.created_at,
    }.get(sort_by, Invoice.due_date)

    if sort_dir == "desc":
        stmt = stmt.order_by(sort_col.desc().nullslast(), Invoice.created_at.desc())
    else:
        stmt = stmt.order_by(sort_col.asc().nullslast(), Invoice.created_at.asc())

    count_stmt = select(func.count()).select_from(
        select(Invoice.id).join(Case, Invoice.case_id == Case.id)
    )
    if case_id:
        count_stmt = select(func.count()).select_from(
            select(Invoice.id).where(Invoice.case_id == case_id)
        )
        if status:
            count_stmt = select(func.count()).select_from(
                select(Invoice.id).where(Invoice.case_id == case_id, Invoice.status == status)
            )
    elif status:
        count_stmt = select(func.count()).select_from(
            select(Invoice.id).where(Invoice.status == status)
        )

    with SessionLocal() as session:
        total = session.scalar(count_stmt)
        rows = session.execute(stmt.limit(limit).offset(offset)).all()
        invoices = [
            _invoice_to_dict(inv, case_name, pbn, payee_name, payee_addr)
            for inv, case_name, pbn, payee_name, payee_addr in rows
        ]
        return {"invoices": invoices, "total": total}


def get_invoice(invoice_id: int) -> Optional[dict]:
    with SessionLocal() as session:
        paid_by = Person.__table__.alias("paid_by")
        row = session.execute(
            select(
                Invoice,
                Case.case_name,
                paid_by.c.name.label("paid_by_name"),
                Payee.name.label("payee_name"),
                Payee.address.label("payee_address"),
            )
            .join(Case, Invoice.case_id == Case.id)
            .outerjoin(paid_by, Invoice.paid_by_person_id == paid_by.c.id)
            .outerjoin(Payee, Invoice.payee_id == Payee.id)
            .where(Invoice.id == invoice_id)
        ).first()
        if not row:
            return None
        inv, case_name, pbn, payee_name, payee_addr = row
        return _invoice_to_dict(inv, case_name, pbn, payee_name, payee_addr)


def create_invoice(
    case_id: int,
    amount: float,
    payee_id: int = None,
    status: str = "unpaid",
    date: str = None,
    due_date: str = None,
    description: str = None,
    category: str = None,
    check_number: str = None,
    paid_date: str = None,
    file_path: str = None,
    file_name: str = None,
    content_type: str = None,
    case_amount: float = None,
    paid_by_person_id: int = None,
    notes: str = None,
) -> dict:
    with SessionLocal() as session:
        inv = Invoice(
            case_id=case_id,
            payee_id=payee_id,
            amount=amount,
            case_amount=case_amount,
            status=status,
            date=date,
            due_date=due_date,
            description=description,
            category=category,
            check_number=check_number,
            paid_by_person_id=paid_by_person_id,
            paid_date=paid_date,
            file_path=file_path,
            file_name=file_name,
            content_type=content_type,
            notes=notes,
        )
        session.add(inv)
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

        comment_payee = payee_name or "unknown payee"
        comment = CaseComment(
            case_id=case_id,
            content=f"Invoice added: ${amount:,.2f} to {comment_payee}",
            is_system=True,
        )
        session.add(comment)

        session.refresh(inv)
        result = _invoice_to_dict(inv, case_name, payee_name=payee_name, payee_address=payee_address)
        session.commit()
        return result


def update_invoice(invoice_id: int, **fields) -> Optional[dict]:
    with SessionLocal() as session:
        inv = session.get(Invoice, invoice_id)
        if not inv:
            return None

        for key, value in fields.items():
            if hasattr(inv, key):
                setattr(inv, key, value)
        inv.updated_at = datetime.datetime.now()

        session.flush()
        session.refresh(inv)

        case = session.get(Case, inv.case_id)
        case_name = case.case_name if case else None
        paid_by_name = None
        if inv.paid_by_person_id:
            p = session.get(Person, inv.paid_by_person_id)
            paid_by_name = p.name if p else None
        payee_name = None
        payee_address = None
        if inv.payee_id:
            payee = session.get(Payee, inv.payee_id)
            if payee:
                payee_name = payee.name
                payee_address = payee.address
        result = _invoice_to_dict(inv, case_name, paid_by_name, payee_name, payee_address)
        session.commit()
        return result


def mark_invoice_paid(
    invoice_id: int, check_number: str = None, paid_date: str = None
) -> Optional[dict]:
    with SessionLocal() as session:
        inv = session.get(Invoice, invoice_id)
        if not inv:
            return None

        inv.status = "paid"
        inv.check_number = check_number
        inv.paid_date = paid_date or datetime.date.today().isoformat()
        inv.updated_at = datetime.datetime.now()

        payee_name = None
        payee_address = None
        if inv.payee_id:
            payee = session.get(Payee, inv.payee_id)
            if payee:
                payee_name = payee.name
                payee_address = payee.address

        comment_payee = payee_name or "unknown payee"
        comment = CaseComment(
            case_id=inv.case_id,
            content=f"Invoice paid: ${float(inv.amount):,.2f} to {comment_payee}"
            + (f" (Ref: {check_number})" if check_number else ""),
            is_system=True,
        )
        session.add(comment)

        session.flush()
        session.refresh(inv)

        case = session.get(Case, inv.case_id)
        case_name = case.case_name if case else None
        paid_by_name = None
        if inv.paid_by_person_id:
            p = session.get(Person, inv.paid_by_person_id)
            paid_by_name = p.name if p else None
        result = _invoice_to_dict(inv, case_name, paid_by_name, payee_name, payee_address)
        session.commit()
        return result


def mark_invoice_unpaid(invoice_id: int) -> Optional[dict]:
    with SessionLocal() as session:
        inv = session.get(Invoice, invoice_id)
        if not inv:
            return None

        inv.status = "unpaid"
        inv.check_number = None
        inv.paid_date = None
        inv.updated_at = datetime.datetime.now()

        session.flush()
        session.refresh(inv)

        case = session.get(Case, inv.case_id)
        case_name = case.case_name if case else None
        paid_by_name = None
        if inv.paid_by_person_id:
            p = session.get(Person, inv.paid_by_person_id)
            paid_by_name = p.name if p else None
        payee_name = None
        payee_address = None
        if inv.payee_id:
            payee = session.get(Payee, inv.payee_id)
            if payee:
                payee_name = payee.name
                payee_address = payee.address
        result = _invoice_to_dict(inv, case_name, paid_by_name, payee_name, payee_address)
        session.commit()
        return result


def delete_invoice(invoice_id: int) -> bool:
    with SessionLocal() as session:
        inv = session.get(Invoice, invoice_id)
        if not inv:
            return False

        if inv.file_path and os.path.isfile(inv.file_path):
            try:
                os.remove(inv.file_path)
            except OSError:
                pass

        session.delete(inv)
        session.commit()
        return True


def get_invoice_stats(case_id: int = None) -> dict:
    effective_amount = func.coalesce(Invoice.case_amount, Invoice.amount)
    with SessionLocal() as session:
        base = select(
            func.count().filter(Invoice.status == "unpaid").label("unpaid_count"),
            func.coalesce(func.sum(sa_case((Invoice.status == "unpaid", effective_amount), else_=0)), 0).label("unpaid_total"),
            func.count().filter(Invoice.status == "paid").label("paid_count"),
            func.coalesce(func.sum(sa_case((Invoice.status == "paid", effective_amount), else_=0)), 0).label("paid_total"),
        )
        if case_id:
            base = base.where(Invoice.case_id == case_id)

        row = session.execute(base).first()
        return {
            "unpaid_count": row.unpaid_count,
            "unpaid_total": str(row.unpaid_total),
            "paid_count": row.paid_count,
            "paid_total": str(row.paid_total),
        }
