"""Invoice management functions — SQLAlchemy ORM implementation."""

import datetime
import os
from pathlib import Path
from typing import Optional

from sqlalchemy import select, func, case as sa_case

from .session import SessionLocal
from models import Invoice, Case, CaseComment, Person, Payee, PersonRole, Role


def _invoice_to_dict(
    inv: Invoice,
    case_name: str = None,
    paid_by_name: str = None,
    payee_name: str = None,
    payee_address: str = None,
    transfer_to_name: str = None,
    advanced_to_name: str = None,
) -> dict:
    return {
        "id": inv.id,
        "case_id": inv.case_id,
        "case_name": case_name,
        "type": inv.type,
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
        "transfer_to_person_id": inv.transfer_to_person_id,
        "transfer_to_name": transfer_to_name,
        "advanced_to_person_id": inv.advanced_to_person_id,
        "advanced_to_name": advanced_to_name,
        "notes": inv.notes,
        "is_transfer": inv.is_transfer,
        "created_at": inv.created_at.isoformat() if inv.created_at else None,
        "updated_at": inv.updated_at.isoformat() if inv.updated_at else None,
    }


def list_invoices(
    case_id: int = None,
    status: str = None,
    type: str = None,
    search: str = None,
    sort_by: str = "due_date",
    sort_dir: str = "asc",
    limit: int = 100,
    offset: int = 0,
) -> dict:
    paid_by = Person.__table__.alias("paid_by")
    transfer_to = Person.__table__.alias("transfer_to")
    advanced_to = Person.__table__.alias("advanced_to")
    stmt = (
        select(
            Invoice,
            Case.case_name,
            paid_by.c.name.label("paid_by_name"),
            Payee.name.label("payee_name"),
            Payee.address.label("payee_address"),
            transfer_to.c.name.label("transfer_to_name"),
            advanced_to.c.name.label("advanced_to_name"),
        )
        .join(Case, Invoice.case_id == Case.id)
        .outerjoin(paid_by, Invoice.paid_by_person_id == paid_by.c.id)
        .outerjoin(Payee, Invoice.payee_id == Payee.id)
        .outerjoin(transfer_to, Invoice.transfer_to_person_id == transfer_to.c.id)
        .outerjoin(advanced_to, Invoice.advanced_to_person_id == advanced_to.c.id)
    )

    if case_id:
        stmt = stmt.where(Invoice.case_id == case_id)
    if status:
        stmt = stmt.where(Invoice.status == status)
    if type:
        stmt = stmt.where(Invoice.type == type)
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

    count_sub = select(Invoice.id)
    if case_id:
        count_sub = count_sub.where(Invoice.case_id == case_id)
    if status:
        count_sub = count_sub.where(Invoice.status == status)
    if type:
        count_sub = count_sub.where(Invoice.type == type)
    count_stmt = select(func.count()).select_from(count_sub)

    with SessionLocal() as session:
        total = session.scalar(count_stmt)
        rows = session.execute(stmt.limit(limit).offset(offset)).all()
        invoices = [
            _invoice_to_dict(inv, case_name, pbn, payee_name, payee_addr, ttn, atn)
            for inv, case_name, pbn, payee_name, payee_addr, ttn, atn in rows
        ]
        return {"invoices": invoices, "total": total}


def get_invoice(invoice_id: int) -> Optional[dict]:
    with SessionLocal() as session:
        paid_by = Person.__table__.alias("paid_by")
        transfer_to = Person.__table__.alias("transfer_to")
        advanced_to = Person.__table__.alias("advanced_to")
        row = session.execute(
            select(
                Invoice,
                Case.case_name,
                paid_by.c.name.label("paid_by_name"),
                Payee.name.label("payee_name"),
                Payee.address.label("payee_address"),
                transfer_to.c.name.label("transfer_to_name"),
                advanced_to.c.name.label("advanced_to_name"),
            )
            .join(Case, Invoice.case_id == Case.id)
            .outerjoin(paid_by, Invoice.paid_by_person_id == paid_by.c.id)
            .outerjoin(Payee, Invoice.payee_id == Payee.id)
            .outerjoin(transfer_to, Invoice.transfer_to_person_id == transfer_to.c.id)
            .outerjoin(advanced_to, Invoice.advanced_to_person_id == advanced_to.c.id)
            .where(Invoice.id == invoice_id)
        ).first()
        if not row:
            return None
        inv, case_name, pbn, payee_name, payee_addr, ttn, atn = row
        return _invoice_to_dict(inv, case_name, pbn, payee_name, payee_addr, ttn, atn)


def create_invoice(
    case_id: int,
    amount: float,
    payee_id: int = None,
    type: str = "cost",
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
    transfer_to_person_id: int = None,
    advanced_to_person_id: int = None,
    notes: str = None,
    is_transfer: bool = False,
) -> dict:
    with SessionLocal() as session:
        inv = Invoice(
            case_id=case_id,
            payee_id=payee_id,
            type=type,
            amount=amount,
            case_amount=case_amount,
            status=status,
            date=date,
            due_date=due_date,
            description=description,
            category=category,
            check_number=check_number,
            paid_by_person_id=paid_by_person_id,
            transfer_to_person_id=transfer_to_person_id,
            advanced_to_person_id=advanced_to_person_id,
            paid_date=paid_date,
            file_path=file_path,
            file_name=file_name,
            content_type=content_type,
            notes=notes,
            is_transfer=is_transfer,
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

        transfer_to_name = None
        if transfer_to_person_id:
            ttp = session.get(Person, transfer_to_person_id)
            transfer_to_name = ttp.name if ttp else None

        advanced_to_name = None
        if advanced_to_person_id:
            atp = session.get(Person, advanced_to_person_id)
            advanced_to_name = atp.name if atp else None

        comment_payee = payee_name or transfer_to_name or "unknown payee"
        if is_transfer:
            label = "Transfer"
        elif type == "advance":
            label = "Advance"
        else:
            label = "Invoice"
        comment = CaseComment(
            case_id=case_id,
            content=f"{label} added: ${amount:,.2f} to {comment_payee}",
            is_system=True,
        )
        session.add(comment)

        session.refresh(inv)
        result = _invoice_to_dict(inv, case_name, payee_name=payee_name, payee_address=payee_address, transfer_to_name=transfer_to_name, advanced_to_name=advanced_to_name)
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
        inv.updated_at = datetime.datetime.now(datetime.timezone.utc)

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
        transfer_to_name = None
        if inv.transfer_to_person_id:
            ttp = session.get(Person, inv.transfer_to_person_id)
            transfer_to_name = ttp.name if ttp else None
        advanced_to_name = None
        if inv.advanced_to_person_id:
            atp = session.get(Person, inv.advanced_to_person_id)
            advanced_to_name = atp.name if atp else None
        result = _invoice_to_dict(inv, case_name, paid_by_name, payee_name, payee_address, transfer_to_name, advanced_to_name)
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
        inv.updated_at = datetime.datetime.now(datetime.timezone.utc)

        payee_name = None
        payee_address = None
        if inv.payee_id:
            payee = session.get(Payee, inv.payee_id)
            if payee:
                payee_name = payee.name
                payee_address = payee.address

        comment_payee = payee_name or "unknown payee"
        label = "Advance" if inv.type == "advance" else "Invoice"
        comment = CaseComment(
            case_id=inv.case_id,
            content=f"{label} paid: ${float(inv.amount):,.2f} to {comment_payee}"
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
        transfer_to_name = None
        if inv.transfer_to_person_id:
            ttp = session.get(Person, inv.transfer_to_person_id)
            transfer_to_name = ttp.name if ttp else None
        advanced_to_name = None
        if inv.advanced_to_person_id:
            atp = session.get(Person, inv.advanced_to_person_id)
            advanced_to_name = atp.name if atp else None
        result = _invoice_to_dict(inv, case_name, paid_by_name, payee_name, payee_address, transfer_to_name, advanced_to_name)
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
        inv.updated_at = datetime.datetime.now(datetime.timezone.utc)

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
        transfer_to_name = None
        if inv.transfer_to_person_id:
            ttp = session.get(Person, inv.transfer_to_person_id)
            transfer_to_name = ttp.name if ttp else None
        advanced_to_name = None
        if inv.advanced_to_person_id:
            atp = session.get(Person, inv.advanced_to_person_id)
            advanced_to_name = atp.name if atp else None
        result = _invoice_to_dict(inv, case_name, paid_by_name, payee_name, payee_address, transfer_to_name, advanced_to_name)
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


def calculate_equalization(case_id: int, our_share_pct: float) -> dict:
    """Calculate what transfer is needed to equalize costs between our firm and co-counsel.

    our_share_pct: our firm's share as a percentage (e.g. 50.0 for 50%).
    Uses all invoices (both pending and paid, excluding existing transfers).
    Returns breakdown and the transfer amount needed.
    """
    effective_amount = func.coalesce(Invoice.case_amount, Invoice.amount)
    with SessionLocal() as session:
        rows = session.execute(
            select(
                Invoice.paid_by_person_id,
                func.coalesce(func.sum(effective_amount), 0).label("total"),
            )
            .where(Invoice.case_id == case_id, Invoice.is_transfer == False, Invoice.type == "cost")  # noqa: E712
            .group_by(Invoice.paid_by_person_id)
        ).all()

        our_total = 0.0
        counsel_totals: dict[int, float] = {}
        for paid_by_id, total in rows:
            amt = float(total)
            if paid_by_id is None:
                our_total += amt
            else:
                counsel_totals[paid_by_id] = counsel_totals.get(paid_by_id, 0) + amt

        grand_total = our_total + sum(counsel_totals.values())
        our_target = grand_total * (our_share_pct / 100.0)
        counsel_target = grand_total - our_target

        counsel_paid = sum(counsel_totals.values())
        difference = our_total - our_target

        counsel_id = None
        counsel_name = None
        if counsel_totals:
            counsel_id = next(iter(counsel_totals))
            p = session.get(Person, counsel_id)
            counsel_name = p.name if p else None

        if counsel_id is None:
            CO_COUNSEL_ROLE_ID = 5
            partner_row = session.execute(
                select(PersonRole, Person)
                .join(Person, PersonRole.person_id == Person.id)
                .where(
                    PersonRole.case_id == case_id,
                    PersonRole.role_id == CO_COUNSEL_ROLE_ID,
                    PersonRole.cost_share_pct.isnot(None),
                )
            ).first()
            if partner_row:
                pr, person = partner_row
                counsel_id = person.id
                counsel_name = person.name

        # Account for existing transfers already settling the balance.
        # net_settled > 0 means counsel has net paid us (reduces our overpayment).
        transfer_rows = session.execute(
            select(
                Invoice.paid_by_person_id,
                Invoice.transfer_to_person_id,
                func.coalesce(func.sum(effective_amount), 0).label("total"),
            )
            .where(Invoice.case_id == case_id, Invoice.is_transfer == True)  # noqa: E712
            .group_by(Invoice.paid_by_person_id, Invoice.transfer_to_person_id)
        ).all()

        net_settled = 0.0
        for paid_by_id, transfer_to_id, total in transfer_rows:
            amt = float(total)
            if paid_by_id is not None:
                net_settled += amt
            elif transfer_to_id is not None:
                net_settled -= amt

        remaining = difference - net_settled

        return {
            "grand_total": round(grand_total, 2),
            "our_total_paid": round(our_total, 2),
            "counsel_total_paid": round(counsel_paid, 2),
            "our_share_pct": our_share_pct,
            "our_target": round(our_target, 2),
            "counsel_target": round(counsel_target, 2),
            "transfer_amount": round(abs(remaining), 2),
            "already_transferred": round(abs(net_settled), 2),
            "direction": "counsel_pays_us" if remaining > 0 else "we_pay_counsel" if remaining < 0 else "even",
            "counsel_id": counsel_id,
            "counsel_name": counsel_name,
        }


def get_invoice_stats(case_id: int = None, type: str = None) -> dict:
    effective_amount = func.coalesce(Invoice.case_amount, Invoice.amount)
    with SessionLocal() as session:
        base = select(
            func.count().filter(Invoice.status == "unpaid").label("unpaid_count"),
            func.coalesce(func.sum(sa_case((Invoice.status == "unpaid", effective_amount), else_=0)), 0).label("unpaid_total"),
            func.count().filter(Invoice.status == "paid").label("paid_count"),
            func.coalesce(func.sum(sa_case((Invoice.status == "paid", effective_amount), else_=0)), 0).label("paid_total"),
        ).where(Invoice.is_transfer == False)  # noqa: E712
        if type:
            base = base.where(Invoice.type == type)
        if case_id:
            base = base.where(Invoice.case_id == case_id)

        row = session.execute(base).first()
        return {
            "unpaid_count": row.unpaid_count,
            "unpaid_total": str(row.unpaid_total),
            "paid_count": row.paid_count,
            "paid_total": str(row.paid_total),
        }


def get_cost_summary(case_id: int) -> dict:
    """Net cost breakdown per party, accounting for transfers."""
    effective_amount = func.coalesce(Invoice.case_amount, Invoice.amount)
    with SessionLocal() as session:
        # Actual costs (excluding transfers and advances)
        cost_rows = session.execute(
            select(
                Invoice.paid_by_person_id,
                func.coalesce(func.sum(effective_amount), 0).label("total"),
            )
            .where(Invoice.case_id == case_id, Invoice.is_transfer == False, Invoice.type == "cost")  # noqa: E712
            .group_by(Invoice.paid_by_person_id)
        ).all()

        our_costs = 0.0
        counsel_costs: dict[int, float] = {}
        for paid_by_id, total in cost_rows:
            amt = float(total)
            if paid_by_id is None:
                our_costs += amt
            else:
                counsel_costs[paid_by_id] = counsel_costs.get(paid_by_id, 0) + amt

        # Transfers
        transfer_rows = session.execute(
            select(
                Invoice.paid_by_person_id,
                Invoice.transfer_to_person_id,
                func.coalesce(func.sum(effective_amount), 0).label("total"),
            )
            .where(Invoice.case_id == case_id, Invoice.is_transfer == True)  # noqa: E712
            .group_by(Invoice.paid_by_person_id, Invoice.transfer_to_person_id)
        ).all()

        # net_to_us > 0 means counsel sent us money
        net_to_us = 0.0
        for paid_by_id, transfer_to_id, total in transfer_rows:
            amt = float(total)
            if paid_by_id is not None:
                net_to_us += amt
            elif transfer_to_id is not None:
                net_to_us -= amt

        counsel_paid_total = sum(counsel_costs.values())
        total_costs = our_costs + counsel_paid_total

        # Net = what each party has effectively spent after transfers settle
        our_net = our_costs - net_to_us
        counsel_net = counsel_paid_total + net_to_us

        # Resolve counsel name
        counsel_id = None
        counsel_name = None
        if counsel_costs:
            counsel_id = next(iter(counsel_costs))
        if counsel_id is None:
            CO_COUNSEL_ROLE_ID = 5
            partner_row = session.execute(
                select(PersonRole, Person)
                .join(Person, PersonRole.person_id == Person.id)
                .where(
                    PersonRole.case_id == case_id,
                    PersonRole.role_id == CO_COUNSEL_ROLE_ID,
                    PersonRole.cost_share_pct.isnot(None),
                )
            ).first()
            if partner_row:
                counsel_id = partner_row[1].id
                counsel_name = partner_row[1].name
        if counsel_id and not counsel_name:
            p = session.get(Person, counsel_id)
            counsel_name = p.name if p else None

        return {
            "total_costs": round(total_costs, 2),
            "our_costs": round(our_costs, 2),
            "counsel_costs": round(counsel_paid_total, 2),
            "our_net": round(our_net, 2),
            "counsel_net": round(counsel_net, 2),
            "net_transferred": round(net_to_us, 2),
            "counsel_id": counsel_id,
            "counsel_name": counsel_name,
        }


def get_cost_sharing(case_id: int) -> dict:
    """Get cost-sharing config for a case: the designated partner and split percentage."""
    CO_COUNSEL_ROLE_ID = 5
    with SessionLocal() as session:
        rows = session.execute(
            select(PersonRole, Person)
            .join(Person, PersonRole.person_id == Person.id)
            .where(
                PersonRole.case_id == case_id,
                PersonRole.role_id == CO_COUNSEL_ROLE_ID,
            )
            .order_by(Person.name)
        ).all()

        co_counsel = []
        partner = None
        for pr, person in rows:
            entry = {
                "person_id": person.id,
                "name": person.name,
                "organization": person.organization,
                "cost_share_pct": float(pr.cost_share_pct) if pr.cost_share_pct is not None else None,
            }
            co_counsel.append(entry)
            if pr.cost_share_pct is not None:
                partner = entry

        our_pct = (100.0 - partner["cost_share_pct"]) if partner else None
        return {
            "co_counsel": co_counsel,
            "partner": partner,
            "our_pct": our_pct,
        }


def set_cost_sharing(case_id: int, person_id: int, cost_share_pct: float) -> dict:
    """Designate a co-counsel as the cost-sharing partner with their share percentage.

    Auto-assigns the person as co-counsel on the case if they aren't already.
    """
    CO_COUNSEL_ROLE_ID = 5
    with SessionLocal() as session:
        all_pr = session.execute(
            select(PersonRole).where(
                PersonRole.case_id == case_id,
                PersonRole.role_id == CO_COUNSEL_ROLE_ID,
            )
        ).scalars().all()

        found = False
        for pr in all_pr:
            if pr.person_id == person_id:
                pr.cost_share_pct = cost_share_pct
                found = True
            else:
                pr.cost_share_pct = None

        if not found:
            pr = PersonRole(
                person_id=person_id,
                role_id=CO_COUNSEL_ROLE_ID,
                case_id=case_id,
                cost_share_pct=cost_share_pct,
            )
            session.add(pr)

        session.commit()
        return get_cost_sharing(case_id)


def remove_cost_sharing(case_id: int) -> dict:
    """Remove the cost-sharing partner from a case.

    Only allowed if the partner has no invoices (paid_by or transfer_to) on this case.
    Returns {"success": True} or raises ValueError.
    """
    config = get_cost_sharing(case_id)
    partner = config.get("partner")
    if not partner:
        raise ValueError("No cost-sharing partner to remove")

    person_id = partner["person_id"]

    with SessionLocal() as session:
        involved = session.execute(
            select(func.count()).select_from(Invoice).where(
                Invoice.case_id == case_id,
                (Invoice.paid_by_person_id == person_id)
                | (Invoice.transfer_to_person_id == person_id),
            )
        ).scalar()

        if involved > 0:
            raise ValueError(
                f"{partner['name']} is involved in {involved} invoice(s) on this case and cannot be removed"
            )

        CO_COUNSEL_ROLE_ID = 5
        prs = session.execute(
            select(PersonRole).where(
                PersonRole.case_id == case_id,
                PersonRole.role_id == CO_COUNSEL_ROLE_ID,
                PersonRole.person_id == person_id,
            )
        ).scalars().all()

        for pr in prs:
            pr.cost_share_pct = None

        session.commit()
        return {"success": True}


def get_advance_stats(case_id: int) -> dict:
    effective_amount = func.coalesce(Invoice.case_amount, Invoice.amount)
    with SessionLocal() as session:
        row = session.execute(
            select(
                func.coalesce(func.sum(effective_amount), 0).label("total"),
                func.count().filter(Invoice.status == "unpaid").label("unpaid_count"),
                func.count().filter(Invoice.status == "paid").label("paid_count"),
            )
            .where(
                Invoice.case_id == case_id,
                Invoice.type == "advance",
                Invoice.is_transfer == False,  # noqa: E712
            )
        ).first()

        advanced_to = Person.__table__.alias("advanced_to")
        recipient_rows = session.execute(
            select(
                Invoice.advanced_to_person_id,
                advanced_to.c.name.label("person_name"),
                func.coalesce(func.sum(effective_amount), 0).label("total"),
            )
            .outerjoin(advanced_to, Invoice.advanced_to_person_id == advanced_to.c.id)
            .where(
                Invoice.case_id == case_id,
                Invoice.type == "advance",
                Invoice.is_transfer == False,  # noqa: E712
            )
            .group_by(Invoice.advanced_to_person_id, advanced_to.c.name)
        ).all()

        by_recipient = [
            {
                "person_id": pid,
                "person_name": pname or "Unspecified",
                "total": round(float(total), 2),
            }
            for pid, pname, total in recipient_rows
        ]

        return {
            "total_advances": round(float(row.total), 2),
            "unpaid_count": row.unpaid_count,
            "paid_count": row.paid_count,
            "by_recipient": by_recipient,
        }
