"""
Case financial CRUD operations — SQLAlchemy ORM implementation.
"""

import datetime
from decimal import Decimal
from typing import Optional, List
from uuid import UUID

from sqlalchemy import select, func, literal_column

from .session import SessionLocal
from .feature_gates import (
    FEATURE_FINANCIALS, feature_enabled_filter, require_feature_for_case,
    is_feature_enabled,
)
from models import Case, CaseFinancial, CaseCounselFee, User


def _sv(val):
    """Serialize a single value to JSON-safe format."""
    if val is None:
        return None
    if isinstance(val, (datetime.datetime, datetime.date, datetime.time)):
        return val.isoformat()
    if isinstance(val, UUID):
        return str(val)
    if isinstance(val, Decimal):
        return float(val)
    return val


def _row_to_dict(row) -> dict:
    """Convert a SQLAlchemy Row to a JSON-safe dict."""
    return {k: _sv(v) for k, v in row._mapping.items()}


def get_all_financials(
    resolution_type: Optional[str] = None,
    is_finalized: Optional[bool] = None,
    attorney_ids: Optional[List[int]] = None,
    search: Optional[str] = None,
    limit: int = 2000,
    offset: int = 0,
) -> dict:
    """Get all case financials joined with case info."""
    with SessionLocal() as session:
        filters = [feature_enabled_filter(FEATURE_FINANCIALS, CaseFinancial.case_id)]
        if resolution_type:
            filters.append(CaseFinancial.resolution_type == resolution_type)
        if is_finalized is not None:
            filters.append(CaseFinancial.is_finalized == is_finalized)
        if attorney_ids:
            from sqlalchemy import cast, Integer, ARRAY as SA_ARRAY
            filters.append(
                Case.attorney_ids.op('&&')(cast(attorney_ids, SA_ARRAY(Integer())))
            )
        if search:
            filters.append(Case.case_name.ilike(f"%{search}%"))

        # Count
        count_stmt = (
            select(func.count())
            .select_from(CaseFinancial)
            .join(Case, Case.id == CaseFinancial.case_id)
        )
        if filters:
            count_stmt = count_stmt.where(*filters)
        total = session.scalar(count_stmt)

        # Our firm fee subquery
        our_fee_sq = literal_column("""(
            SELECT COALESCE(
                CASE WHEN ccf.fee_type = 'percentage'
                    THEN case_financials.gross_recovery * ccf.fee_percentage / 100
                    ELSE ccf.fee_flat_amount
                END, 0)
            FROM case_counsel_fees ccf
            WHERE ccf.financial_id = case_financials.id AND ccf.is_our_firm = true
            LIMIT 1
        )""").label("our_fee")

        counsel_count_sq = literal_column("""(
            SELECT COUNT(*) FROM case_counsel_fees ccf
            WHERE ccf.financial_id = case_financials.id
        )""").label("counsel_count")

        stmt = (
            select(
                CaseFinancial.id,
                CaseFinancial.case_id,
                Case.case_name,
                Case.short_name,
                Case.attorney_ids,
                CaseFinancial.resolution_type,
                CaseFinancial.resolution_date,
                CaseFinancial.gross_recovery,
                CaseFinancial.costs_advanced,
                CaseFinancial.liens_total,
                CaseFinancial.is_finalized,
                CaseFinancial.notes,
                CaseFinancial.created_at,
                CaseFinancial.updated_at,
                our_fee_sq,
                counsel_count_sq,
            )
            .join(Case, Case.id == CaseFinancial.case_id)
            .order_by(Case.case_name)
        )
        if filters:
            stmt = stmt.where(*filters)
        if limit:
            stmt = stmt.limit(limit)
        if offset:
            stmt = stmt.offset(offset)

        rows = session.execute(stmt).fetchall()
        financials = [_row_to_dict(r) for r in rows]

        return {"financials": financials, "total": total}


def get_financial_by_id(financial_id: int) -> Optional[dict]:
    """Get a single financial record with counsel fees."""
    with SessionLocal() as session:
        fin = session.get(CaseFinancial, financial_id)
        if not fin:
            return None
        if not is_feature_enabled(session, fin.case_id, FEATURE_FINANCIALS):
            return None

        result = {
            "id": fin.id,
            "case_id": fin.case_id,
            "resolution_type": fin.resolution_type,
            "resolution_date": _sv(fin.resolution_date),
            "gross_recovery": _sv(fin.gross_recovery),
            "costs_advanced": _sv(fin.costs_advanced),
            "liens_total": _sv(fin.liens_total),
            "is_finalized": fin.is_finalized,
            "notes": fin.notes,
            "created_at": _sv(fin.created_at),
            "updated_at": _sv(fin.updated_at),
        }

        # Case info
        case = session.get(Case, fin.case_id)
        if case:
            result["case_name"] = case.case_name
            result["short_name"] = case.short_name
            result["attorney_ids"] = case.attorney_ids

        # Counsel fees
        fee_stmt = (
            select(CaseCounselFee)
            .where(CaseCounselFee.financial_id == financial_id)
            .order_by(CaseCounselFee.sort_order)
        )
        fees = []
        for fee in session.scalars(fee_stmt):
            fees.append({
                "id": fee.id,
                "person_role_id": fee.person_role_id,
                "counsel_name": fee.counsel_name,
                "is_our_firm": fee.is_our_firm,
                "fee_type": fee.fee_type,
                "fee_percentage": _sv(fee.fee_percentage),
                "fee_flat_amount": _sv(fee.fee_flat_amount),
                "sort_order": fee.sort_order,
                "notes": fee.notes,
            })
        result["counsel_fees"] = fees

        return result


def create_financial(case_id: int, **kwargs) -> dict:
    """Create a financial record for a case. Auto-creates an 'our firm' counsel fee."""
    with SessionLocal() as session:
        require_feature_for_case(session, case_id, FEATURE_FINANCIALS)
        fin = CaseFinancial(case_id=case_id, **kwargs)
        session.add(fin)
        session.flush()
        # Always create our firm's fee entry
        our_fee = CaseCounselFee(
            financial_id=fin.id,
            counsel_name="Galipo Law",
            is_our_firm=True,
            fee_type="percentage",
            sort_order=0,
        )
        session.add(our_fee)
        fid = fin.id
        session.commit()
    return get_financial_by_id(fid)


def update_financial(financial_id: int, **kwargs) -> Optional[dict]:
    """Update a financial record."""
    allowed = [
        "resolution_type", "resolution_date", "gross_recovery",
        "costs_advanced", "liens_total", "is_finalized", "notes",
    ]
    with SessionLocal() as session:
        fin = session.get(CaseFinancial, financial_id)
        if not fin:
            return None
        require_feature_for_case(session, fin.case_id, FEATURE_FINANCIALS)
        changed = False
        for field, value in kwargs.items():
            if field not in allowed:
                continue
            setattr(fin, field, value)
            changed = True
        if changed:
            fin.updated_at = func.now()
        session.commit()
    return get_financial_by_id(financial_id)


def delete_financial(financial_id: int) -> bool:
    """Delete a financial record and its counsel fees."""
    with SessionLocal() as session:
        fin = session.get(CaseFinancial, financial_id)
        if not fin:
            return False
        require_feature_for_case(session, fin.case_id, FEATURE_FINANCIALS)
        session.delete(fin)
        session.commit()
        return True


def get_financial_by_case(case_id: int) -> Optional[dict]:
    """Get the financial record for a case (one-to-one)."""
    with SessionLocal() as session:
        if not is_feature_enabled(session, case_id, FEATURE_FINANCIALS):
            return None
        fin_id = session.scalar(
            select(CaseFinancial.id).where(CaseFinancial.case_id == case_id)
        )
        if not fin_id:
            return None
    return get_financial_by_id(fin_id)


# =============================================================================
# Counsel Fee CRUD
# =============================================================================

def _counsel_fee_case_id(session, fee_id: int) -> Optional[int]:
    """Look up the case_id for a counsel fee (via its parent financial)."""
    return session.scalar(
        select(CaseFinancial.case_id)
        .join(CaseCounselFee, CaseCounselFee.financial_id == CaseFinancial.id)
        .where(CaseCounselFee.id == fee_id)
    )


def create_counsel_fee(financial_id: int, **kwargs) -> dict:
    """Create a counsel fee record."""
    with SessionLocal() as session:
        fin = session.get(CaseFinancial, financial_id)
        if fin is not None:
            require_feature_for_case(session, fin.case_id, FEATURE_FINANCIALS)
        fee = CaseCounselFee(financial_id=financial_id, **kwargs)
        session.add(fee)
        session.flush()
        fid = fee.financial_id
        session.commit()
    return get_financial_by_id(fid)


def update_counsel_fee(fee_id: int, **kwargs) -> Optional[dict]:
    """Update a counsel fee record."""
    allowed = [
        "counsel_name", "is_our_firm", "fee_type",
        "fee_percentage", "fee_flat_amount", "sort_order", "notes",
    ]
    with SessionLocal() as session:
        fee = session.get(CaseCounselFee, fee_id)
        if not fee:
            return None
        case_id = _counsel_fee_case_id(session, fee_id)
        require_feature_for_case(session, case_id, FEATURE_FINANCIALS)
        for field, value in kwargs.items():
            if field not in allowed:
                continue
            setattr(fee, field, value)
        fid = fee.financial_id
        session.commit()
    return get_financial_by_id(fid)


def delete_counsel_fee(fee_id: int) -> Optional[dict]:
    """Delete a counsel fee. Returns updated financial."""
    with SessionLocal() as session:
        fee = session.get(CaseCounselFee, fee_id)
        if not fee:
            return None
        case_id = _counsel_fee_case_id(session, fee_id)
        require_feature_for_case(session, case_id, FEATURE_FINANCIALS)
        fid = fee.financial_id
        session.delete(fee)
        session.commit()
    return get_financial_by_id(fid)


def get_resolution_type_counts(attorney_ids: Optional[List[int]] = None) -> dict:
    """Get counts grouped by resolution_type."""
    with SessionLocal() as session:
        stmt = (
            select(CaseFinancial.resolution_type, func.count(CaseFinancial.id))
            .join(Case, Case.id == CaseFinancial.case_id)
            .where(feature_enabled_filter(FEATURE_FINANCIALS, CaseFinancial.case_id))
            .group_by(CaseFinancial.resolution_type)
        )
        if attorney_ids:
            from sqlalchemy import cast, Integer, ARRAY as SA_ARRAY
            stmt = stmt.where(
                Case.attorney_ids.op('&&')(cast(attorney_ids, SA_ARRAY(Integer())))
            )
        rows = session.execute(stmt).all()
        return {rtype or "Unspecified": count for rtype, count in rows}
