"""
Unified contact search — persons and judges together.
"""

import re
from typing import List

from sqlalchemy import select, func, or_, cast, String
from sqlalchemy.orm import joinedload
from rapidfuzz import fuzz

from .session import SessionLocal
from models import Person, Judge, PersonRole, Role, Case, Jurisdiction


def unified_contact_search(query: str, limit: int = 25) -> dict:
    """Search persons and judges together with fuzzy + exact matching."""
    normalized = query.strip().lower()
    digits_only = re.sub(r"\D", "", query)

    results = []

    with SessionLocal() as session:
        # --- Person search ---
        person_conditions = [Person.archived == False]  # noqa: E712
        name_cond = Person.name.ilike(f"%{normalized}%")
        org_cond = Person.organization.ilike(f"%{normalized}%")
        email_cond = cast(Person.emails, String).ilike(f"%{normalized}%")

        phone_conds = []
        if len(digits_only) >= 4:
            phone_conds.append(cast(Person.phones, String).contains(digits_only))

        person_conditions.append(or_(name_cond, org_cond, email_cond, *phone_conds))

        person_stmt = (
            select(Person)
            .where(*person_conditions)
            .limit(limit)
        )
        persons = session.scalars(person_stmt).all()

        for p in persons:
            score = fuzz.WRatio(normalized, (p.name or "").lower())
            # Boost for exact phone/email matches
            phones_str = str(p.phones or [])
            emails_str = str(p.emails or []).lower()
            if digits_only and len(digits_only) >= 4 and digits_only in re.sub(r"\D", "", phones_str):
                score = max(score, 95)
            if normalized in emails_str:
                score = max(score, 90)

            # Get role summary
            role_stmt = (
                select(PersonRole, Role, Case)
                .join(Role, PersonRole.role_id == Role.id)
                .outerjoin(Case, PersonRole.case_id == Case.id)
                .where(PersonRole.person_id == p.id)
                .limit(3)
            )
            role_rows = session.execute(role_stmt).all()
            role_parts = []
            for pr, role, case in role_rows:
                part = role.name.replace("_", " ").title()
                if case and case.short_name:
                    part += f" · {case.short_name}"
                role_parts.append(part)

            results.append({
                "type": "person",
                "id": p.id,
                "name": p.name,
                "phones": p.phones or [],
                "emails": p.emails or [],
                "organization": p.organization,
                "role_summary": " | ".join(role_parts[:2]) if role_parts else None,
                "score": score,
            })

        # --- Judge search ---
        judge_conditions = []
        judge_name_cond = Judge.name.ilike(f"%{normalized}%")
        judge_email_cond = cast(Judge.emails, String).ilike(f"%{normalized}%")

        judge_phone_conds = []
        if len(digits_only) >= 4:
            judge_phone_conds.append(cast(Judge.phones, String).contains(digits_only))

        judge_conditions.append(or_(
            judge_name_cond,
            judge_email_cond,
            *judge_phone_conds,
            Jurisdiction.name.ilike(f"%{normalized}%"),
        ))

        judge_stmt = (
            select(Judge, Jurisdiction)
            .outerjoin(Jurisdiction, Judge.jurisdiction_id == Jurisdiction.id)
            .where(*judge_conditions)
            .limit(limit)
        )
        judge_rows = session.execute(judge_stmt).all()

        for judge, jurisdiction in judge_rows:
            score = fuzz.WRatio(normalized, (judge.name or "").lower())
            if digits_only and len(digits_only) >= 4:
                phones_str = str(judge.phones or [])
                if digits_only in re.sub(r"\D", "", phones_str):
                    score = max(score, 95)

            results.append({
                "type": "judge",
                "id": judge.id,
                "name": judge.name,
                "phones": judge.phones or [],
                "emails": judge.emails or [],
                "jurisdiction": jurisdiction.name if jurisdiction else None,
                "title": judge.title,
                "courtroom": judge.courtroom_number,
                "score": score,
            })

    # Sort by score descending, limit total
    results.sort(key=lambda r: r["score"], reverse=True)
    return {"results": results[:limit], "total": len(results)}
