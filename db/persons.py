"""
Person/contact management functions.

The unified roles schema:
- persons table: simplified identity (name, contact info only - no person_type)
- roles table: role definitions with categories
- person_roles: junction table linking persons to roles with optional case_id
"""

import json
from typing import Optional, List

from sqlalchemy import select, func, exists, text
from sqlalchemy.orm import aliased

from .session import SessionLocal
from .validation import validate_date_format, ValidationError
from .fuzzy_match import (
    resolve_person as _resolve_person,
    fuzzy_search_persons as _fuzzy_search_persons,
    PersonMatchResult,
    normalize_name,
    score_name_match,
)
from models import Person, PersonRole, Role, Case, ExpertiseType, DuplicateDismissal
from schemas import PersonOut, CasePersonOut, RoleBriefOut, RoleAssignmentOut


def _person_to_dict(p: Person) -> dict:
    """Convert a Person ORM instance to a serializable dict."""
    d = PersonOut.model_validate(p).model_dump(mode="json")
    d["phones"] = p.phones or []
    d["emails"] = p.emails or []
    return d


def _assignment_to_dict(pr: PersonRole, person: Person, role: Role,
                        case: Case = None, grouped_under: Person = None) -> dict:
    """Convert a person_role assignment row to a serializable dict with nested role object."""
    return CasePersonOut(
        id=person.id, name=person.name,
        phones=person.phones or [], emails=person.emails or [],
        organization=person.organization, person_notes=person.notes,
        assignment_id=pr.id, role_id=pr.role_id,
        attributes=pr.attributes or {}, role_notes=pr.notes,
        is_primary=pr.is_primary,
        cost_share_pct=float(pr.cost_share_pct) if pr.cost_share_pct is not None else None,
        grouped_under_id=pr.grouped_under_id,
        assigned_date=pr.assigned_date.isoformat() if pr.assigned_date else None,
        assigned_at=pr.created_at.isoformat() if pr.created_at else None,
        role=RoleBriefOut(id=role.id, name=role.name, category=role.category),
        grouped_under_name=grouped_under.name if grouped_under else None,
    ).model_dump(mode="json")


def _role_assignment_to_dict(pr: PersonRole, role: Role,
                             case: Case = None, grouped_under: Person = None) -> dict:
    """Convert a role assignment for get_person_by_id (includes case info)."""
    return RoleAssignmentOut(
        assignment_id=pr.id, role_id=pr.role_id, case_id=pr.case_id,
        attributes=pr.attributes or {}, role_notes=pr.notes,
        is_primary=pr.is_primary, grouped_under_id=pr.grouped_under_id,
        assigned_date=pr.assigned_date.isoformat() if pr.assigned_date else None,
        created_at=pr.created_at.isoformat() if pr.created_at else None,
        role=RoleBriefOut(id=role.id, name=role.name, category=role.category),
        case_name=case.case_name if case else None,
        short_name=case.short_name if case else None,
        color=case.color if case else None,
        grouped_under_name=grouped_under.name if grouped_under else None,
    ).model_dump(mode="json")


def _validate_and_ensure_expertises(session, role_id: int, attributes: dict) -> dict:
    """Validate expertise list for expert roles and auto-create missing types."""
    if not attributes:
        return attributes

    expertises = attributes.get("expertises")
    if expertises is None:
        return attributes

    # Only validate expertises for expert roles
    role = session.get(Role, role_id)
    if not role or role.category != "expert":
        return attributes

    if not isinstance(expertises, list):
        raise ValidationError("expertises must be a list")
    if not all(isinstance(e, str) and e.strip() for e in expertises):
        raise ValidationError("each expertise must be a non-empty string")

    # Auto-create missing expertise types
    for name in expertises:
        existing = session.scalar(
            select(ExpertiseType.id).where(ExpertiseType.name == name)
        )
        if not existing:
            session.add(ExpertiseType(name=name))
            session.flush()

    return attributes


def create_person(name: str, phones: List[dict] = None, emails: List[dict] = None,
                  address: str = None, organization: str = None,
                  notes: str = None, **kwargs) -> dict:
    """Create a new person (without any role assignment)."""
    with SessionLocal() as session:
        p = Person(
            name=name,
            phones=phones or [],
            emails=emails or [],
            address=address,
            organization=organization,
            notes=notes,
        )
        session.add(p)
        session.flush()
        session.refresh(p)
        result = _person_to_dict(p)
        session.commit()
        return result


def get_person_by_id(person_id: int) -> Optional[dict]:
    """Get person by ID with their role assignments."""
    with SessionLocal() as session:
        p = session.get(Person, person_id)
        if not p:
            return None

        result = _person_to_dict(p)

        # Get role assignments (both case-specific and standalone)
        GroupedUnder = aliased(Person)
        stmt = (
            select(PersonRole, Role, Case, GroupedUnder)
            .join(Role, PersonRole.role_id == Role.id)
            .outerjoin(Case, PersonRole.case_id == Case.id)
            .outerjoin(GroupedUnder, PersonRole.grouped_under_id == GroupedUnder.id)
            .where(PersonRole.person_id == person_id)
            .order_by(Case.case_name.nulls_first(), Role.category, Role.sort_order)
        )
        rows = session.execute(stmt).all()
        result["roles"] = [
            _role_assignment_to_dict(pr, role, case, grouped_under)
            for pr, role, case, grouped_under in rows
        ]

        return result


def update_person(person_id: int, **kwargs) -> Optional[dict]:
    """Update person fields."""
    allowed_fields = ["name", "phones", "emails", "address", "organization", "notes"]

    with SessionLocal() as session:
        p = session.get(Person, person_id)
        if not p:
            return None

        changed = False
        for field, value in kwargs.items():
            if field not in allowed_fields:
                continue
            if value is None:
                continue
            setattr(p, field, value)
            changed = True

        if changed:
            p.updated_at = func.now()

        session.commit()

    return get_person_by_id(person_id)


def search_persons(name: str = None, role_id: int = None, category: str = None,
                   organization: str = None, email: str = None, phone: str = None,
                   case_id: int = None, unassigned: bool = False,
                   include_roles: bool = False, user_id: int = None,
                   limit: int = 50, offset: int = 0) -> dict:
    """Search persons by various criteria."""
    conditions = [Person.archived == False]  # noqa: E712

    if name:
        conditions.append(Person.name.ilike(f"%{name}%"))
    if organization:
        conditions.append(Person.organization.ilike(f"%{organization}%"))
    if email:
        conditions.append(Person.emails.cast(text("text")).ilike(f"%{email}%"))
    if phone:
        conditions.append(Person.phones.cast(text("text")).ilike(f"%{phone}%"))

    if role_id:
        conditions.append(
            exists(
                select(PersonRole.id)
                .where(PersonRole.person_id == Person.id, PersonRole.role_id == role_id)
            )
        )
    if category:
        conditions.append(
            exists(
                select(PersonRole.id)
                .join(Role, PersonRole.role_id == Role.id)
                .where(PersonRole.person_id == Person.id, Role.category == category)
            )
        )
    if case_id:
        conditions.append(
            exists(
                select(PersonRole.id)
                .where(PersonRole.person_id == Person.id, PersonRole.case_id == case_id)
            )
        )
    if unassigned:
        conditions.append(
            ~exists(
                select(PersonRole.id)
                .where(PersonRole.person_id == Person.id)
            )
        )
    if user_id:
        conditions.append(
            exists(
                select(PersonRole.id)
                .join(Case, PersonRole.case_id == Case.id)
                .where(
                    PersonRole.person_id == Person.id,
                    Case.attorney_ids.any(user_id) | Case.paralegal_ids.any(user_id),
                )
            )
        )

    with SessionLocal() as session:
        # Count
        count_stmt = select(func.count(Person.id))
        for cond in conditions:
            count_stmt = count_stmt.where(cond)
        total = session.scalar(count_stmt)

        # Fetch persons
        stmt = (
            select(Person)
            .order_by(Person.name)
            .limit(limit)
            .offset(offset)
        )
        for cond in conditions:
            stmt = stmt.where(cond)

        persons_list = session.scalars(stmt).all()
        persons = []
        for p in persons_list:
            d = {
                "id": p.id,
                "name": p.name,
                "phones": p.phones or [],
                "emails": p.emails or [],
                "organization": p.organization,
                "notes": p.notes,
                "archived": p.archived,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            persons.append(d)

        # Optionally fetch roles for all returned persons
        if include_roles and persons:
            person_ids = [p["id"] for p in persons]
            role_stmt = (
                select(PersonRole, Role, Case)
                .join(Role, PersonRole.role_id == Role.id)
                .outerjoin(Case, PersonRole.case_id == Case.id)
                .where(PersonRole.person_id.in_(person_ids))
                .order_by(Case.case_name.nulls_first(), Role.category, Role.sort_order)
            )
            role_rows = session.execute(role_stmt).all()

            roles_map: dict = {}
            for pr, role, case in role_rows:
                pid = pr.person_id
                if pid not in roles_map:
                    roles_map[pid] = []
                roles_map[pid].append({
                    "assignment_id": pr.id,
                    "role_id": pr.role_id,
                    "role": {
                        "id": role.id,
                        "name": role.name,
                        "category": role.category,
                    },
                    "case_id": pr.case_id,
                    "case_name": case.case_name if case else None,
                    "short_name": case.short_name if case else None,
                    "color": case.color if case else None,
                })
            for p in persons:
                p["roles"] = roles_map.get(p["id"], [])

        return {"persons": persons, "total": total}


def check_person_duplicates(name: str) -> PersonMatchResult:
    """Check if a person name fuzzy-matches existing persons."""
    with SessionLocal() as session:
        return _resolve_person(session, name)


def fuzzy_search_persons_db(name: str, limit: int = 10) -> list[dict]:
    """Fuzzy search for persons by name. Returns scored results."""
    with SessionLocal() as session:
        return _fuzzy_search_persons(session, name, limit=limit)


def delete_person(person_id: int) -> bool:
    """Permanently delete a person. Clears grouped_under references first."""
    with SessionLocal() as session:
        p = session.get(Person, person_id)
        if not p:
            return False

        # Clear grouped_under references
        session.execute(
            PersonRole.__table__.update()
            .where(PersonRole.grouped_under_id == person_id)
            .values(grouped_under_id=None)
        )

        session.delete(p)
        session.commit()
        return True


def archive_person(person_id: int) -> Optional[dict]:
    """Archive a person (soft delete)."""
    with SessionLocal() as session:
        p = session.get(Person, person_id)
        if not p:
            return None

        p.archived = True
        p.updated_at = func.now()
        session.commit()

    return get_person_by_id(person_id)


# ===== CASE-PERSON ROLE OPERATIONS =====

def assign_person_to_case(case_id: int, person_id: int, role_id: int,
                          attributes: dict = None, notes: str = None,
                          is_primary: bool = False, grouped_under_id: int = None,
                          assigned_date: str = None) -> dict:
    """Assign a person to a case with a specific role."""
    validate_date_format(assigned_date, "assigned_date")

    with SessionLocal() as session:
        # Validate expertises for expert roles
        if attributes:
            _validate_and_ensure_expertises(session, role_id, attributes)

        # Check if assignment already exists
        existing = session.scalar(
            select(PersonRole.id).where(
                PersonRole.person_id == person_id,
                PersonRole.role_id == role_id,
                PersonRole.case_id == case_id,
            )
        )

        if existing:
            # Update existing assignment
            pr = session.get(PersonRole, existing)
            pr.attributes = attributes or {}
            pr.notes = notes
            pr.is_primary = is_primary
            pr.grouped_under_id = grouped_under_id
            pr.assigned_date = assigned_date
            session.flush()
        else:
            # Insert new assignment
            pr = PersonRole(
                person_id=person_id,
                role_id=role_id,
                case_id=case_id,
                attributes=attributes or {},
                notes=notes,
                is_primary=is_primary,
                grouped_under_id=grouped_under_id,
                assigned_date=assigned_date,
            )
            session.add(pr)
            session.flush()

        # Return full assignment details
        session.refresh(pr)
        person_obj = session.get(Person, pr.person_id)
        role_obj = session.get(Role, pr.role_id)
        grouped_obj = session.get(Person, pr.grouped_under_id) if pr.grouped_under_id else None

        result = _assignment_to_dict(pr, person_obj, role_obj, grouped_under=grouped_obj)
        session.commit()
        return result


def update_case_assignment(assignment_id: int, **kwargs) -> Optional[dict]:
    """Update a person_roles assignment by ID."""
    allowed_fields = ["attributes", "notes", "is_primary", "grouped_under_id", "assigned_date"]

    with SessionLocal() as session:
        pr = session.get(PersonRole, assignment_id)
        if not pr:
            return None

        # Validate expertises for expert roles if attributes are being updated
        if "attributes" in kwargs and isinstance(kwargs["attributes"], dict):
            _validate_and_ensure_expertises(session, pr.role_id, kwargs["attributes"])

        # grouped_under_id: frontend sends an assignment_id, but the FK
        # references persons.id — resolve it to the person_id.
        if "grouped_under_id" in kwargs and kwargs["grouped_under_id"] is not None:
            target_pr = session.get(PersonRole, kwargs["grouped_under_id"])
            if not target_pr:
                raise ValidationError(f"Target assignment {kwargs['grouped_under_id']} not found")
            kwargs["grouped_under_id"] = target_pr.person_id

        changed = False
        for field, value in kwargs.items():
            if field not in allowed_fields:
                continue
            if field == "assigned_date" and value:
                validate_date_format(value, "assigned_date")
            setattr(pr, field, value)
            changed = True

        if not changed:
            return None

        session.flush()

        # Return full assignment details
        person_obj = session.get(Person, pr.person_id)
        role_obj = session.get(Role, pr.role_id)
        grouped_obj = session.get(Person, pr.grouped_under_id) if pr.grouped_under_id else None

        result = _assignment_to_dict(pr, person_obj, role_obj, grouped_under=grouped_obj)
        session.commit()
        return result


def change_person_role_on_case(case_id: int, person_id: int, old_role_id: int,
                               new_role_id: int) -> Optional[dict]:
    """Change a person's role on a case."""
    if old_role_id == new_role_id:
        return None

    with SessionLocal() as session:
        # Check new role doesn't already exist for this person+case
        existing_new = session.scalar(
            select(PersonRole.id).where(
                PersonRole.case_id == case_id,
                PersonRole.person_id == person_id,
                PersonRole.role_id == new_role_id,
            )
        )
        if existing_new:
            raise ValidationError("Person already has this role on this case")

        # Get the assignment
        pr = session.scalar(
            select(PersonRole).where(
                PersonRole.case_id == case_id,
                PersonRole.person_id == person_id,
                PersonRole.role_id == old_role_id,
            )
        )
        if not pr:
            return None

        # Update role and clear grouped_under_id
        pr.role_id = new_role_id
        pr.grouped_under_id = None

        # Clear grouped_under_id on anyone grouped under this person in this case
        session.execute(
            PersonRole.__table__.update()
            .where(
                PersonRole.case_id == case_id,
                PersonRole.grouped_under_id == person_id,
            )
            .values(grouped_under_id=None)
        )

        session.flush()

        # Return full assignment details
        person_obj = session.get(Person, pr.person_id)
        role_obj = session.get(Role, pr.role_id)
        grouped_obj = session.get(Person, pr.grouped_under_id) if pr.grouped_under_id else None

        result = _assignment_to_dict(pr, person_obj, role_obj, grouped_under=grouped_obj)
        session.commit()
        return result


def remove_person_from_case(case_id: int, person_id: int, role_id: int = None) -> bool:
    """Remove a person from a case. Severs any grouped_under relationships first."""
    with SessionLocal() as session:
        # Clear grouped_under references pointing to this person on this case
        session.execute(
            PersonRole.__table__.update()
            .where(
                PersonRole.case_id == case_id,
                PersonRole.grouped_under_id == person_id,
            )
            .values(grouped_under_id=None)
        )

        # Delete the assignment(s)
        conditions = [
            PersonRole.case_id == case_id,
            PersonRole.person_id == person_id,
        ]
        if role_id:
            conditions.append(PersonRole.role_id == role_id)

        assignments = session.scalars(
            select(PersonRole).where(*conditions)
        ).all()

        if not assignments:
            return False

        for a in assignments:
            session.delete(a)

        session.commit()
        return True


# ===== CASE PERSONS QUERY =====

def get_case_persons(case_id: int, role_id: int = None, category: str = None) -> List[dict]:
    """Get all persons assigned to a case with optional filters."""
    with SessionLocal() as session:
        GroupedUnder = aliased(Person)
        stmt = (
            select(PersonRole, Person, Role, GroupedUnder)
            .join(Person, PersonRole.person_id == Person.id)
            .join(Role, PersonRole.role_id == Role.id)
            .outerjoin(GroupedUnder, PersonRole.grouped_under_id == GroupedUnder.id)
            .where(PersonRole.case_id == case_id)
            .order_by(Role.category, Role.sort_order, Person.name)
        )

        if role_id:
            stmt = stmt.where(PersonRole.role_id == role_id)
        if category:
            stmt = stmt.where(Role.category == category)

        rows = session.execute(stmt).all()
        results = []
        for pr, person, role, grouped_under in rows:
            d = _assignment_to_dict(pr, person, role, grouped_under=grouped_under)
            results.append(d)
        return results


# ===== DUPLICATE DETECTION & MERGE =====

def find_duplicate_persons() -> dict:
    """Find groups of potential duplicate persons using exact + fuzzy matching.

    Uses rapidfuzz.process.extract for fast batch fuzzy comparison rather than
    O(n^2) pairwise score_name_match calls.
    """
    from rapidfuzz import fuzz as _fuzz
    from .fuzzy_match import extract_last_name, soundex

    FUZZY_THRESHOLD = 93
    PREFILTER_THRESHOLD = 50

    with SessionLocal() as session:
        all_persons = session.scalars(
            select(Person).where(Person.archived == False)  # noqa: E712
        ).all()

        person_dicts = {}
        for p in all_persons:
            person_dicts[p.id] = {
                "id": p.id,
                "name": p.name,
                "phones": p.phones or [],
                "emails": p.emails or [],
                "organization": p.organization,
                "notes": p.notes,
            }

        dismissed_rows = session.scalars(select(DuplicateDismissal)).all()
        dismissed_pairs = {(r.person_id_a, r.person_id_b) for r in dismissed_rows}

        def is_dismissed(id_a: int, id_b: int) -> bool:
            a, b = min(id_a, id_b), max(id_a, id_b)
            return (a, b) in dismissed_pairs

        parent = {p.id: p.id for p in all_persons}

        def find(x):
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        def union(a, b):
            ra, rb = find(a), find(b)
            if ra != rb:
                parent[ra] = rb

        match_info = {}

        # Exact name groups
        name_map: dict[str, list[int]] = {}
        for p in all_persons:
            norm = normalize_name(p.name, "person")
            name_map.setdefault(norm, []).append(p.id)

        for norm, ids in name_map.items():
            if len(ids) > 1:
                for i in range(1, len(ids)):
                    if is_dismissed(ids[0], ids[i]):
                        continue
                    union(ids[0], ids[i])
                    key = (min(ids[0], ids[i]), max(ids[0], ids[i]))
                    match_info[key] = ["exact_name"]

        # Fuzzy matching — batch via last-name soundex buckets for speed
        unique_names = [(norm, ids[0]) for norm, ids in name_map.items()]

        # Group by soundex of last name — only compare within same bucket
        soundex_buckets: dict[str, list[tuple[str, int]]] = {}
        for norm, pid in unique_names:
            last = extract_last_name(norm)
            sx = soundex(last) if last else ""
            soundex_buckets.setdefault(sx, []).append((norm, pid))

        for sx, bucket in soundex_buckets.items():
            if len(bucket) < 2:
                continue
            for i in range(len(bucket)):
                for j in range(i + 1, len(bucket)):
                    norm_a, id_a = bucket[i]
                    norm_b, id_b = bucket[j]
                    # Fast pre-filter, then full scorer for candidates
                    quick = _fuzz.token_sort_ratio(norm_a, norm_b)
                    if quick < PREFILTER_THRESHOLD:
                        continue
                    score = score_name_match(norm_a, norm_b, entity="person")
                    char_ratio = _fuzz.ratio(norm_a, norm_b)
                    if score >= FUZZY_THRESHOLD and char_ratio >= 91 and not is_dismissed(id_a, id_b):
                        union(id_a, id_b)
                        key = (min(id_a, id_b), max(id_a, id_b))
                        if key not in match_info:
                            match_info[key] = [f"fuzzy_name ({score:.0f}%)"]

        # Collect groups
        clusters: dict[int, list[int]] = {}
        for pid in parent:
            root = find(pid)
            clusters.setdefault(root, []).append(pid)

        groups = []
        for root, ids in sorted(clusters.items(), key=lambda x: -len(x[1])):
            if len(ids) < 2:
                continue
            ids.sort()
            persons = [person_dicts[pid] for pid in ids]

            reasons = set()
            for i in range(len(ids)):
                for j in range(i + 1, len(ids)):
                    key = (ids[i], ids[j])
                    if key in match_info:
                        reasons.update(match_info[key])
            if not reasons:
                reasons = {"fuzzy_name"}

            has_conflicts = _check_merge_conflicts(session, ids)
            groups.append({
                "persons": persons,
                "match_reasons": sorted(reasons),
                "has_conflicts": has_conflicts,
            })

        return {"groups": groups, "total": len(groups)}


def _check_merge_conflicts(session, person_ids: list) -> bool:
    """Check if merging a group of persons would have assignment conflicts."""
    if len(person_ids) < 2:
        return False

    # Check for overlapping person_roles assignments (same case_id + role_id)
    row = session.execute(text("""
        SELECT case_id, role_id, COUNT(DISTINCT person_id) as cnt
        FROM person_roles
        WHERE person_id = ANY(:pids) AND case_id IS NOT NULL
        GROUP BY case_id, role_id
        HAVING COUNT(DISTINCT person_id) > 1
        LIMIT 1
    """), {"pids": person_ids}).first()
    if row:
        return True

    # Check for conflicting scalar fields
    persons = []
    for pid in person_ids[:2]:
        p = session.get(Person, pid)
        if p:
            persons.append(p)

    if len(persons) >= 2:
        p, s = persons[0], persons[1]
        for field in ['organization', 'address']:
            pv = (getattr(p, field, None) or '').strip()
            sv = (getattr(s, field, None) or '').strip()
            if pv and sv and pv.lower() != sv.lower():
                return True

    return False


def dismiss_duplicate(person_ids: list[int]) -> dict:
    """Dismiss a group of persons as not duplicates."""
    with SessionLocal() as session:
        pairs_added = 0
        for i in range(len(person_ids)):
            for j in range(i + 1, len(person_ids)):
                a, b = min(person_ids[i], person_ids[j]), max(person_ids[i], person_ids[j])
                existing = session.scalars(
                    select(DuplicateDismissal).where(
                        DuplicateDismissal.person_id_a == a,
                        DuplicateDismissal.person_id_b == b,
                    )
                ).first()
                if not existing:
                    session.add(DuplicateDismissal(person_id_a=a, person_id_b=b))
                    pairs_added += 1
        session.commit()
        return {"success": True, "pairs_dismissed": pairs_added}


def preview_merge(primary_id: int, secondary_id: int) -> dict:
    """Preview what a merge would look like, identifying conflicts."""
    primary = get_person_by_id(primary_id)
    secondary = get_person_by_id(secondary_id)
    if not primary or not secondary:
        return {"error": "One or both persons not found"}

    # Find field conflicts
    field_conflicts = []
    for field in ['name', 'organization', 'address']:
        pv = (primary.get(field) or '')
        sv = (secondary.get(field) or '')
        if isinstance(pv, str):
            pv = pv.strip()
        if isinstance(sv, str):
            sv = sv.strip()
        if pv and sv and str(pv).lower() != str(sv).lower():
            field_conflicts.append({
                "field": field,
                "primary_value": primary.get(field),
                "secondary_value": secondary.get(field),
            })

    # Check notes conflict
    pn = (primary.get('notes') or '').strip()
    sn = (secondary.get('notes') or '').strip()
    if pn and sn and pn != sn:
        field_conflicts.append({
            "field": "notes",
            "primary_value": primary.get('notes'),
            "secondary_value": secondary.get('notes'),
        })

    # Find assignment conflicts
    with SessionLocal() as session:
        rows = session.execute(text("""
            SELECT pr1.case_id, pr1.role_id, c.case_name, c.short_name, r.name as role_name
            FROM person_roles pr1
            JOIN person_roles pr2 ON pr1.case_id = pr2.case_id AND pr1.role_id = pr2.role_id
            JOIN cases c ON pr1.case_id = c.id
            JOIN roles r ON pr1.role_id = r.id
            WHERE pr1.person_id = :pid AND pr2.person_id = :sid
        """), {"pid": primary_id, "sid": secondary_id}).mappings().all()

        assignment_conflicts = [{
            "case_id": r["case_id"],
            "role_id": r["role_id"],
            "role_name": r["role_name"],
            "case_name": r["case_name"],
            "short_name": r["short_name"],
        } for r in rows]

    auto_mergeable = (
        len(field_conflicts) == 0 and
        len(assignment_conflicts) == 0
    )

    return {
        "primary": primary,
        "secondary": secondary,
        "conflicts": {
            "field_conflicts": field_conflicts,
            "assignment_conflicts": assignment_conflicts,
        },
        "auto_mergeable": auto_mergeable,
    }


def merge_persons(primary_id: int, secondary_id: int,
                  field_resolutions: dict = None) -> dict:
    """Merge secondary person into primary person.

    Steps (in a single transaction):
    1. Reassign person_roles from secondary -> primary (skip constraint conflicts)
    2. Reassign person_roles.grouped_under_id from secondary -> primary
    3. Update primary person's fields per resolutions
    4. Delete secondary person
    """
    if not field_resolutions:
        field_resolutions = {}

    with SessionLocal() as session:
        primary = session.get(Person, primary_id)
        secondary = session.get(Person, secondary_id)

        if not primary or not secondary:
            return {"error": "One or both persons not found"}

        # 1. Delete secondary's assignments that would conflict with primary's
        session.execute(text("""
            DELETE FROM person_roles
            WHERE person_id = :sid
            AND (case_id, role_id) IN (
                SELECT case_id, role_id FROM person_roles WHERE person_id = :pid AND case_id IS NOT NULL
            )
        """), {"sid": secondary_id, "pid": primary_id})

        # Reassign remaining
        session.execute(
            PersonRole.__table__.update()
            .where(PersonRole.person_id == secondary_id)
            .values(person_id=primary_id)
        )

        # 2. Reassign grouped_under_id references
        session.execute(
            PersonRole.__table__.update()
            .where(PersonRole.grouped_under_id == secondary_id)
            .values(grouped_under_id=primary_id)
        )

        # Clear circular grouped_under
        session.execute(
            PersonRole.__table__.update()
            .where(
                PersonRole.person_id == primary_id,
                PersonRole.grouped_under_id == primary_id,
            )
            .values(grouped_under_id=None)
        )

        # 3. Merge person fields
        # Scalar fields
        for field in ['name', 'organization', 'address']:
            resolution = field_resolutions.get(field)
            if resolution == 'secondary':
                sv = getattr(secondary, field, None)
                if sv:
                    setattr(primary, field, sv)
            elif resolution == 'primary':
                pass  # Keep primary's value
            else:
                # Auto: use primary if non-empty, else secondary
                pv = getattr(primary, field, None)
                sv = getattr(secondary, field, None)
                if not pv and sv:
                    setattr(primary, field, sv)

        # Notes - concatenate or pick
        notes_resolution = field_resolutions.get('notes', 'concatenate')
        pn = (primary.notes or '').strip()
        sn = (secondary.notes or '').strip()
        if notes_resolution == 'secondary':
            if sn:
                primary.notes = sn
        elif notes_resolution == 'primary':
            pass
        elif notes_resolution == 'concatenate':
            if pn and sn:
                primary.notes = f"{pn}\n\n---\n\n{sn}"
            elif sn:
                primary.notes = sn

        # Phones - union by value
        p_phones = list(primary.phones or [])
        s_phones = list(secondary.phones or [])
        existing_values = {p.get('value', '') for p in p_phones}
        for phone in s_phones:
            if phone.get('value', '') not in existing_values:
                p_phones.append(phone)
                existing_values.add(phone.get('value', ''))
        primary.phones = p_phones

        # Emails - union by value (case-insensitive)
        p_emails = list(primary.emails or [])
        s_emails = list(secondary.emails or [])
        existing_values = {e.get('value', '').lower() for e in p_emails}
        for email in s_emails:
            if email.get('value', '').lower() not in existing_values:
                p_emails.append(email)
                existing_values.add(email.get('value', '').lower())
        primary.emails = p_emails

        primary.updated_at = func.now()

        # 4. Delete secondary person
        session.delete(secondary)
        session.commit()

    return get_person_by_id(primary_id)
