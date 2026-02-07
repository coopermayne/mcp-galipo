"""
Case CRUD operations — SQLAlchemy ORM implementation.
"""

import datetime
from decimal import Decimal
from typing import Optional, List
from uuid import UUID

from sqlalchemy import select, func, literal_column, or_, cast, Integer, ARRAY as SA_ARRAY
from sqlalchemy.orm import aliased

from .session import SessionLocal
from .validation import validate_case_status, validate_date_format
from models import (
    Case, User, PersonRole, Role, Person, Activity, Event, Task, Note,
    Proceeding, ProceedingJudge, Judge, Jurisdiction,
)


# Color palette for case chips (10 visually distinct colors)
CASE_COLORS = [
    "blue", "emerald", "amber", "red", "violet",
    "pink", "cyan", "orange", "indigo", "teal",
]


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


def get_next_case_color() -> str:
    """Get the next color in the rotation based on existing case count."""
    with SessionLocal() as session:
        count = session.scalar(select(func.count()).select_from(Case))
        return CASE_COLORS[count % len(CASE_COLORS)]


def get_all_cases(status_filter: Optional[str] = None, limit: int = None,
                  offset: int = None, attorney_ids: List[int] = None,
                  unassigned: bool = False) -> dict:
    """Get all cases with optional status filter and attorney filter."""
    with SessionLocal() as session:
        filters = []
        if status_filter:
            validate_case_status(status_filter)
            filters.append(Case.status == status_filter)
        if attorney_ids:
            filters.append(Case.attorney_ids.op('&&')(cast(attorney_ids, SA_ARRAY(Integer()))))
        elif unassigned:
            filters.append(or_(
                Case.attorney_ids == None,
                func.coalesce(func.array_length(Case.attorney_ids, 1), 0) == 0,
            ))

        # Count
        count_stmt = select(func.count()).select_from(Case)
        if filters:
            count_stmt = count_stmt.where(*filters)
        total = session.scalar(count_stmt)

        # Correlated subqueries via literal_column
        judge_sq = literal_column("""(
            SELECT j.name FROM proceedings p
            JOIN proceeding_judges pj ON p.id = pj.proceeding_id
            JOIN judges j ON pj.judge_id = j.id
            WHERE p.case_id = cases.id AND p.is_primary = true
            ORDER BY pj.sort_order LIMIT 1
        )""").label("judge")

        client_count_sq = literal_column("""(
            SELECT COUNT(*) FROM person_roles pr
            JOIN roles r ON pr.role_id = r.id
            WHERE pr.case_id = cases.id AND r.name = 'Client'
        )""").label("client_count")

        defendant_count_sq = literal_column("""(
            SELECT COUNT(*) FROM person_roles pr
            JOIN roles r ON pr.role_id = r.id
            WHERE pr.case_id = cases.id AND r.name = 'Defendant'
        )""").label("defendant_count")

        pending_task_sq = literal_column("""(
            SELECT COUNT(*) FROM tasks t
            WHERE t.case_id = cases.id AND t.status = 'Pending'
        )""").label("pending_task_count")

        upcoming_event_sq = literal_column("""(
            SELECT COUNT(*) FROM events e
            WHERE e.case_id = cases.id AND e.date >= CURRENT_DATE
        )""").label("upcoming_event_count")

        stmt = (
            select(
                Case.id, Case.case_name, Case.short_name, Case.status,
                Case.print_code, Case.attorney_ids, Case.paralegal_ids,
                judge_sq, client_count_sq, defendant_count_sq,
                pending_task_sq, upcoming_event_sq,
            )
            .order_by(Case.case_name)
        )
        if filters:
            stmt = stmt.where(*filters)
        if limit:
            stmt = stmt.limit(limit)
        if offset:
            stmt = stmt.offset(offset)

        rows = session.execute(stmt).fetchall()
        cases = [_row_to_dict(r) for r in rows]

        return {"cases": cases, "total": total}


def get_case_by_id(case_id: int) -> Optional[dict]:
    """Get full case details by ID with all related data."""
    with SessionLocal() as session:
        case = session.get(Case, case_id)
        if not case:
            return None

        result = {
            "id": case.id,
            "case_name": case.case_name,
            "short_name": case.short_name,
            "status": case.status,
            "print_code": case.print_code,
            "case_summary": case.case_summary,
            "result": case.result,
            "date_of_injury": _sv(case.date_of_injury),
            "color": case.color,
            "attorney_ids": case.attorney_ids,
            "paralegal_ids": case.paralegal_ids,
            "created_at": _sv(case.created_at),
            "updated_at": _sv(case.updated_at),
        }

        # Expand attorney_ids to user objects
        attorney_ids = case.attorney_ids or []
        if attorney_ids:
            att_stmt = (
                select(User.id, User.email, User.first_name, User.last_name,
                       User.initials, User.position)
                .where(User.id.in_(attorney_ids))
                .order_by(User.last_name, User.first_name)
            )
            result["attorneys"] = [_row_to_dict(r) for r in session.execute(att_stmt)]
        else:
            result["attorneys"] = []

        # Expand paralegal_ids to user objects
        paralegal_ids = case.paralegal_ids or []
        if paralegal_ids:
            par_stmt = (
                select(User.id, User.email, User.first_name, User.last_name,
                       User.initials, User.position)
                .where(User.id.in_(paralegal_ids))
                .order_by(User.last_name, User.first_name)
            )
            result["paralegals"] = [_row_to_dict(r) for r in session.execute(par_stmt)]
        else:
            result["paralegals"] = []

        # Persons with roles (aliased Person for grouped_under self-join)
        GroupedUnder = aliased(Person)
        persons_stmt = (
            select(
                Person.id, Person.name, Person.phones, Person.emails,
                Person.organization, Person.notes.label("person_notes"),
                PersonRole.id.label("assignment_id"), PersonRole.role_id,
                PersonRole.attributes, PersonRole.notes.label("role_notes"),
                PersonRole.is_primary, PersonRole.grouped_under_id,
                PersonRole.assigned_date, PersonRole.created_at.label("assigned_at"),
                Role.name.label("role_name"), Role.category.label("role_category"),
                Role.sort_order.label("role_sort_order"),
                GroupedUnder.name.label("grouped_under_name"),
            )
            .select_from(Person)
            .join(PersonRole, PersonRole.person_id == Person.id)
            .join(Role, Role.id == PersonRole.role_id)
            .outerjoin(GroupedUnder, GroupedUnder.id == PersonRole.grouped_under_id)
            .where(PersonRole.case_id == case_id)
            .order_by(Role.category, Role.sort_order, Person.name)
        )
        persons = []
        for row in session.execute(persons_stmt):
            person = _row_to_dict(row)
            person["role"] = {
                "id": person["role_id"],
                "name": person.pop("role_name"),
                "category": person.pop("role_category"),
            }
            person.pop("role_sort_order", None)
            persons.append(person)
        result["persons"] = persons

        # Activities
        act_stmt = (
            select(Activity.id, Activity.date, Activity.description,
                   Activity.type, Activity.minutes)
            .where(Activity.case_id == case_id)
            .order_by(Activity.date.desc())
        )
        result["activities"] = [_row_to_dict(r) for r in session.execute(act_stmt)]

        # Events
        evt_stmt = (
            select(Event.id, Event.date, Event.time, Event.location,
                   Event.description, Event.document_link,
                   Event.calculation_note, Event.starred)
            .where(Event.case_id == case_id)
            .order_by(Event.date)
        )
        result["events"] = [_row_to_dict(r) for r in session.execute(evt_stmt)]

        # Tasks with event description
        task_stmt = (
            select(Task.id, Task.due_date, Task.completion_date, Task.description,
                   Task.status, Task.urgency, Task.event_id, Task.sort_order,
                   Event.description.label("event_description"))
            .outerjoin(Event, Event.id == Task.event_id)
            .where(Task.case_id == case_id)
            .order_by(Task.sort_order.asc())
        )
        result["tasks"] = [_row_to_dict(r) for r in session.execute(task_stmt)]

        # Notes
        note_stmt = (
            select(Note.id, Note.content, Note.created_at, Note.updated_at)
            .where(Note.case_id == case_id)
            .order_by(Note.created_at.desc())
        )
        result["notes"] = [_row_to_dict(r) for r in session.execute(note_stmt)]

        # Proceedings with jurisdiction
        proc_stmt = (
            select(
                Proceeding.id, Proceeding.case_id, Proceeding.case_number,
                Proceeding.jurisdiction_id, Proceeding.sort_order,
                Proceeding.is_primary, Proceeding.notes,
                Proceeding.created_at, Proceeding.updated_at,
                Jurisdiction.name.label("jurisdiction_name"),
                Jurisdiction.local_rules_link,
            )
            .outerjoin(Jurisdiction, Jurisdiction.id == Proceeding.jurisdiction_id)
            .where(Proceeding.case_id == case_id)
            .order_by(Proceeding.sort_order, Proceeding.id)
        )
        proceedings = [_row_to_dict(r) for r in session.execute(proc_stmt)]

        # Judges for all proceedings in one query
        if proceedings:
            proceeding_ids = [p["id"] for p in proceedings]
            judge_stmt = (
                select(
                    ProceedingJudge.proceeding_id, ProceedingJudge.judge_id,
                    ProceedingJudge.role, ProceedingJudge.sort_order,
                    Judge.name.label("judge_name"),
                )
                .join(Judge, Judge.id == ProceedingJudge.judge_id)
                .where(ProceedingJudge.proceeding_id.in_(proceeding_ids))
                .order_by(ProceedingJudge.sort_order, ProceedingJudge.id)
            )

            judges_by_proceeding = {}
            for row in session.execute(judge_stmt):
                d = dict(row._mapping)
                pid = d["proceeding_id"]
                if pid not in judges_by_proceeding:
                    judges_by_proceeding[pid] = []
                judges_by_proceeding[pid].append({
                    "judge_id": d["judge_id"],
                    "name": d["judge_name"],
                    "role": d["role"],
                    "sort_order": d["sort_order"],
                })

            for p in proceedings:
                p["judges"] = judges_by_proceeding.get(p["id"], [])
                if p["judges"]:
                    p["judge_name"] = p["judges"][0]["name"]
                    p["judge_id"] = p["judges"][0]["judge_id"]
                else:
                    p["judge_name"] = None
                    p["judge_id"] = None

        result["proceedings"] = proceedings

        return result


def get_case_by_name(case_name: str) -> Optional[dict]:
    """Get case by name."""
    with SessionLocal() as session:
        case_id = session.scalar(
            select(Case.id).where(Case.case_name == case_name)
        )
        if not case_id:
            return None
    return get_case_by_id(case_id)


def get_all_case_names() -> List[str]:
    """Get list of all case names."""
    with SessionLocal() as session:
        return list(session.scalars(
            select(Case.case_name).order_by(Case.case_name)
        ).all())


def create_case(case_name: str, status: str = "Signing Up",
                print_code: str = None, case_summary: str = None, result: str = None,
                date_of_injury: str = None, short_name: str = None) -> dict:
    """Create a new case. Case numbers are added via proceedings."""
    validate_case_status(status)
    validate_date_format(date_of_injury, "date_of_injury")

    if short_name is None:
        short_name = case_name.split()[0] if case_name else None

    color = get_next_case_color()

    with SessionLocal() as session:
        case = Case(
            case_name=case_name,
            short_name=short_name,
            status=status,
            print_code=print_code,
            case_summary=case_summary,
            result=result,
            date_of_injury=date_of_injury,
            color=color,
        )
        session.add(case)
        session.flush()
        case_id = case.id
        session.commit()

    return get_case_by_id(case_id)


def update_case(case_id: int, **kwargs) -> Optional[dict]:
    """Update case fields. Case numbers are managed via proceedings."""
    allowed_fields = [
        "case_name", "short_name", "status", "print_code",
        "case_summary", "result", "date_of_injury"
    ]

    with SessionLocal() as session:
        case = session.get(Case, case_id)
        if not case:
            return None

        changed = False
        for field, value in kwargs.items():
            if field not in allowed_fields:
                continue
            if value is None:
                continue

            if field == "status":
                validate_case_status(value)
            elif field == "date_of_injury":
                validate_date_format(value, field)

            setattr(case, field, value)
            changed = True

        if changed:
            case.updated_at = func.now()
        session.commit()

    return get_case_by_id(case_id)


def delete_case(case_id: int) -> bool:
    """Delete a case and all related data."""
    with SessionLocal() as session:
        case = session.get(Case, case_id)
        if not case:
            return False
        session.delete(case)
        session.commit()
        return True


def search_cases(query: str = None, case_number: str = None, person_name: str = None,
                 status: str = None, limit: int = 50) -> List[dict]:
    """Search cases by various criteria."""
    with SessionLocal() as session:
        stmt = select(Case.id, Case.case_name, Case.short_name,
                      Case.status, Case.case_summary)

        if query:
            stmt = stmt.where(or_(
                Case.case_name.ilike(f"%{query}%"),
                Case.case_summary.ilike(f"%{query}%"),
            ))

        if case_number:
            subq = (
                select(literal_column("1"))
                .select_from(Proceeding)
                .where(
                    Proceeding.case_id == Case.id,
                    Proceeding.case_number.ilike(f"%{case_number}%"),
                )
                .correlate(Case)
                .exists()
            )
            stmt = stmt.where(subq)

        if person_name:
            subq = (
                select(literal_column("1"))
                .select_from(PersonRole)
                .join(Person, Person.id == PersonRole.person_id)
                .where(
                    PersonRole.case_id == Case.id,
                    Person.name.ilike(f"%{person_name}%"),
                )
                .correlate(Case)
                .exists()
            )
            stmt = stmt.where(subq)

        if status:
            validate_case_status(status)
            stmt = stmt.where(Case.status == status)

        stmt = stmt.order_by(Case.case_name).limit(limit)
        return [dict(r._mapping) for r in session.execute(stmt)]


def get_case_summary(case_id: int) -> Optional[dict]:
    """Get lightweight case summary with counts instead of full related data."""
    with SessionLocal() as session:
        person_count_sq = literal_column("""(
            SELECT COUNT(*) FROM person_roles pr WHERE pr.case_id = cases.id
        )""").label("person_count")
        task_count_sq = literal_column("""(
            SELECT COUNT(*) FROM tasks t WHERE t.case_id = cases.id
        )""").label("task_count")
        pending_task_sq = literal_column("""(
            SELECT COUNT(*) FROM tasks t WHERE t.case_id = cases.id AND t.status = 'Pending'
        )""").label("pending_task_count")
        event_count_sq = literal_column("""(
            SELECT COUNT(*) FROM events e WHERE e.case_id = cases.id
        )""").label("event_count")
        upcoming_event_sq = literal_column("""(
            SELECT COUNT(*) FROM events e WHERE e.case_id = cases.id AND e.date >= CURRENT_DATE
        )""").label("upcoming_event_count")
        note_count_sq = literal_column("""(
            SELECT COUNT(*) FROM notes n WHERE n.case_id = cases.id
        )""").label("note_count")
        proceeding_count_sq = literal_column("""(
            SELECT COUNT(*) FROM proceedings p WHERE p.case_id = cases.id
        )""").label("proceeding_count")

        stmt = (
            select(
                Case.id, Case.case_name, Case.short_name, Case.status,
                Case.print_code, Case.case_summary, Case.date_of_injury,
                Case.result, Case.created_at, Case.updated_at,
                person_count_sq, task_count_sq, pending_task_sq,
                event_count_sq, upcoming_event_sq, note_count_sq,
                proceeding_count_sq,
            )
            .where(Case.id == case_id)
        )

        row = session.execute(stmt).first()
        if not row:
            return None
        return _row_to_dict(row)


def get_dashboard_stats(attorney_ids: list[int] | None = None) -> dict:
    """Get dashboard statistics, optionally filtered to cases assigned to given attorneys."""
    with SessionLocal() as session:
        case_filters = []
        if attorney_ids:
            case_filters.append(Case.attorney_ids.op('&&')(cast(attorney_ids, SA_ARRAY(Integer()))))

        # Total cases
        total_stmt = select(func.count()).select_from(Case)
        if case_filters:
            total_stmt = total_stmt.where(*case_filters)
        total_cases = session.scalar(total_stmt)

        # Active cases (not Closed or Settl. Pend.)
        active_stmt = (
            select(func.count()).select_from(Case)
            .where(Case.status.notin_(["Closed", "Settl. Pend."]))
        )
        if case_filters:
            active_stmt = active_stmt.where(*case_filters)
        active_cases = session.scalar(active_stmt)

        # Pending tasks
        pending_tasks = session.scalar(
            select(func.count()).select_from(Task)
            .where(Task.status == "Pending")
        )

        # Upcoming events (next 30 days)
        upcoming_events = session.scalar(
            select(func.count()).select_from(Event)
            .where(
                Event.date >= func.current_date(),
                Event.date <= func.current_date() + 30,
            )
        )

        # Cases by status
        status_stmt = (
            select(Case.status, func.count().label("count"))
            .group_by(Case.status)
            .order_by(func.count().desc())
        )
        if case_filters:
            status_stmt = status_stmt.where(*case_filters)
        cases_by_status = {
            row.status: row.count
            for row in session.execute(status_stmt)
        }

        return {
            "total_cases": total_cases,
            "active_cases": active_cases,
            "pending_tasks": pending_tasks,
            "upcoming_events": upcoming_events,
            "cases_by_status": cases_by_status,
        }


# =============================================================================
# Case Staff Assignments (Attorneys & Paralegals)
# =============================================================================

def get_case_users(case_id: int) -> dict:
    """Get all staff users (attorneys and paralegals) assigned to a case."""
    with SessionLocal() as session:
        case = session.get(Case, case_id)
        if not case:
            return {"attorneys": [], "paralegals": []}

        attorney_ids = case.attorney_ids or []
        paralegal_ids = case.paralegal_ids or []

        attorneys = []
        if attorney_ids:
            att_stmt = (
                select(User.id, User.email, User.first_name, User.last_name,
                       User.initials, User.position, User.paralegal_id)
                .where(User.id.in_(attorney_ids))
                .order_by(User.last_name, User.first_name)
            )
            attorneys = [_row_to_dict(r) for r in session.execute(att_stmt)]

        paralegals = []
        if paralegal_ids:
            par_stmt = (
                select(User.id, User.email, User.first_name, User.last_name,
                       User.initials, User.position)
                .where(User.id.in_(paralegal_ids))
                .order_by(User.last_name, User.first_name)
            )
            paralegals = [_row_to_dict(r) for r in session.execute(par_stmt)]

        return {"attorneys": attorneys, "paralegals": paralegals}


def assign_attorney_to_case(case_id: int, user_id: int) -> dict:
    """
    Assign an attorney to a case. Auto-assigns their default paralegal if set.
    Returns updated case staff and list of auto-assigned paralegal IDs.
    """
    with SessionLocal() as session:
        case = session.get(Case, case_id)
        user = session.get(User, user_id)
        if not case or not user:
            return {"success": False, "error": "Case or user not found"}

        attorney_ids = list(case.attorney_ids or [])
        paralegal_ids = list(case.paralegal_ids or [])
        auto_assigned = []

        if user_id not in attorney_ids:
            attorney_ids.append(user_id)
            case.attorney_ids = attorney_ids
            case.updated_at = func.now()

        if user.paralegal_id and user.paralegal_id not in paralegal_ids:
            paralegal_ids.append(user.paralegal_id)
            case.paralegal_ids = paralegal_ids
            case.updated_at = func.now()
            auto_assigned.append(user.paralegal_id)

        session.commit()

    return {
        "success": True,
        "case_users": get_case_users(case_id),
        "auto_assigned_paralegal_ids": auto_assigned,
    }


def remove_attorney_from_case(case_id: int, user_id: int) -> dict:
    """Remove an attorney from a case."""
    with SessionLocal() as session:
        case = session.get(Case, case_id)
        if not case:
            return {"success": False, "error": "Case not found"}

        attorney_ids = list(case.attorney_ids or [])
        if user_id in attorney_ids:
            attorney_ids.remove(user_id)
            case.attorney_ids = attorney_ids
            case.updated_at = func.now()

        session.commit()

    return {"success": True, "case_users": get_case_users(case_id)}


def assign_paralegal_to_case(case_id: int, user_id: int) -> dict:
    """Manually assign a paralegal to a case."""
    with SessionLocal() as session:
        case = session.get(Case, case_id)
        if not case:
            return {"success": False, "error": "Case not found"}

        paralegal_ids = list(case.paralegal_ids or [])
        if user_id not in paralegal_ids:
            paralegal_ids.append(user_id)
            case.paralegal_ids = paralegal_ids
            case.updated_at = func.now()

        session.commit()

    return {"success": True, "case_users": get_case_users(case_id)}


def remove_paralegal_from_case(case_id: int, user_id: int) -> dict:
    """Remove a paralegal from a case."""
    with SessionLocal() as session:
        case = session.get(Case, case_id)
        if not case:
            return {"success": False, "error": "Case not found"}

        paralegal_ids = list(case.paralegal_ids or [])
        if user_id in paralegal_ids:
            paralegal_ids.remove(user_id)
            case.paralegal_ids = paralegal_ids
            case.updated_at = func.now()

        session.commit()

    return {"success": True, "case_users": get_case_users(case_id)}


def get_cases_for_user(user_id: int, role: str = None) -> List[dict]:
    """Get all cases where this user is assigned (as attorney or paralegal)."""
    with SessionLocal() as session:
        stmt = select(Case.id, Case.case_name, Case.short_name, Case.status)

        if role == "attorney":
            stmt = stmt.where(Case.attorney_ids.op('@>')(cast([user_id], SA_ARRAY(Integer()))))
        elif role == "paralegal":
            stmt = stmt.where(Case.paralegal_ids.op('@>')(cast([user_id], SA_ARRAY(Integer()))))
        else:
            stmt = stmt.where(or_(
                Case.attorney_ids.op('@>')(cast([user_id], SA_ARRAY(Integer()))),
                Case.paralegal_ids.op('@>')(cast([user_id], SA_ARRAY(Integer()))),
            ))

        stmt = stmt.order_by(Case.case_name)
        return [_row_to_dict(r) for r in session.execute(stmt)]
