"""
Worklog (voice-driven work log) data layer.

A day is an editable ledger of time-estimated entries. Entries come from two
places:
  • AI consolidation — a VoiceLog session (status 'processing' -> 'done' /
    'failed') whose background job writes entries that land directly in the day.
  • Manual add — a standalone entry (voice_log_id NULL).

Entries are always live (no confirm gate); they're editable and deletable at any
time, including on past days (backfill). VoiceLogSource records which surfaced
items were pulled into a session so the candidate list can flag what's already
been logged for a day.
"""

import datetime
from typing import Optional

from sqlalchemy import select, func, cast, or_
from sqlalchemy import ARRAY as SA_ARRAY, Integer
from sqlalchemy.orm import selectinload

from .session import SessionLocal
from models import (
    VoiceLog,
    VoiceLogSource,
    WorklogEntry,
    WorklogEntryPerson,
    Case,
    Event,
    Task,
    CaseComment,
    Person,
    User,
)

TERMINAL_TASK_STATUSES = ("Done",)


def _parse_date(s: Optional[str]) -> datetime.date:
    if not s:
        from lib.tz import today_la
        return today_la()
    return datetime.date.fromisoformat(s)


def _changed_to_terminal_today(day: datetime.date):
    """Predicate: task moved to a terminal status on `day` (Pacific)."""
    return (
        Task.status.in_(TERMINAL_TASK_STATUSES)
        & (func.date(func.timezone("America/Los_Angeles", Task.updated_at)) == day)
    )


# ---------------------------------------------------------------------------
# Surfaced candidates
# ---------------------------------------------------------------------------

def _logged_source_keys(session, day: datetime.date) -> set[str]:
    """`{source_type}:{source_id}` already pulled into a (non-failed) log for the
    day — used to flag candidates as already logged."""
    rows = session.execute(
        select(VoiceLogSource.source_type, VoiceLogSource.source_id)
        .join(VoiceLog, VoiceLogSource.voice_log_id == VoiceLog.id)
        .where(VoiceLog.log_date == day, VoiceLog.status != "failed")
    ).all()
    return {f"{r.source_type}:{r.source_id}" for r in rows}


def get_worklog_candidates(log_date: str, user_id: Optional[int]) -> dict:
    """Surface events / tasks finished that day / the user's own comments for
    `log_date`, scoped to the user's cases. Each item carries `already_logged`."""
    day = _parse_date(log_date)
    uid_arr = cast([user_id], SA_ARRAY(Integer())) if user_id else None

    def case_scope(stmt):
        if uid_arr is None:
            return stmt
        return stmt.where(or_(
            Case.attorney_ids.op('@>')(uid_arr),
            Case.paralegal_ids.op('@>')(uid_arr),
        ))

    events: list[dict] = []
    tasks: list[dict] = []
    comments: list[dict] = []

    with SessionLocal() as session:
        logged = _logged_source_keys(session, day)

        def mark(d: dict) -> dict:
            d["already_logged"] = f"{d['source_type']}:{d['source_id']}" in logged
            return d

        ev_stmt = case_scope(
            select(Event, Case)
            .join(Case, Event.case_id == Case.id)
            .where(Event.date == day)
            .order_by(Event.time.is_(None), Event.time)
        )
        for ev, case in session.execute(ev_stmt).all():
            events.append(mark({
                "source_type": "event",
                "source_id": ev.id,
                "case_id": ev.case_id,
                "case_name": case.case_name if case else None,
                "short_name": case.short_name if case else None,
                "description": ev.description,
                "anchored_minutes": 60 if ev.time is not None else None,
                "when": ev.time.strftime("%-I:%M %p") if ev.time else (ev.event_type or None),
            }))

        task_stmt = case_scope(
            select(Task, Case)
            .join(Case, Task.case_id == Case.id)
            .where(or_(Task.completion_date == day, _changed_to_terminal_today(day)))
            .order_by(Task.updated_at)
        )
        seen_task_ids: set[int] = set()
        for tk, case in session.execute(task_stmt).all():
            if tk.id in seen_task_ids:
                continue
            seen_task_ids.add(tk.id)
            tasks.append(mark({
                "source_type": "task",
                "source_id": tk.id,
                "case_id": tk.case_id,
                "case_name": case.case_name if case else None,
                "short_name": case.short_name if case else None,
                "description": tk.description,
                "anchored_minutes": None,
                "when": "completed" if tk.completion_date == day else "updated",
            }))

        cm_stmt = (
            select(CaseComment, Case)
            .join(Case, CaseComment.case_id == Case.id)
            .where(
                CaseComment.is_system.isnot(True),
                func.date(func.timezone("America/Los_Angeles", CaseComment.created_at)) == day,
            )
            .order_by(CaseComment.created_at)
        )
        if user_id:
            cm_stmt = cm_stmt.where(CaseComment.user_id == user_id)
        for cm, case in session.execute(cm_stmt).all():
            comments.append(mark({
                "source_type": "comment",
                "source_id": cm.id,
                "case_id": cm.case_id,
                "case_name": case.case_name if case else None,
                "short_name": case.short_name if case else None,
                "description": cm.content,
                "anchored_minutes": None,
                "when": None,
            }))

    return {"events": events, "tasks": tasks, "comments": comments}


def resolve_selection_context(selections: list[dict], user_id: Optional[int]) -> list[dict]:
    """Resolve [{source_type, source_id}] to text/case/duration for the AI."""
    out: list[dict] = []
    if not selections:
        return out
    by_type: dict[str, list[int]] = {"event": [], "task": [], "comment": []}
    for s in selections:
        st, sid = s.get("source_type"), s.get("source_id")
        if st in by_type and isinstance(sid, int):
            by_type[st].append(sid)

    with SessionLocal() as session:
        if by_type["event"]:
            for ev, case in session.execute(
                select(Event, Case).outerjoin(Case, Event.case_id == Case.id)
                .where(Event.id.in_(by_type["event"]))
            ).all():
                out.append({"case_id": ev.case_id, "case_name": case.case_name if case else None,
                            "description": ev.description,
                            "anchored_minutes": 60 if ev.time is not None else None})
        if by_type["task"]:
            for tk, case in session.execute(
                select(Task, Case).outerjoin(Case, Task.case_id == Case.id)
                .where(Task.id.in_(by_type["task"]))
            ).all():
                out.append({"case_id": tk.case_id, "case_name": case.case_name if case else None,
                            "description": tk.description, "anchored_minutes": None})
        if by_type["comment"]:
            for cm, case in session.execute(
                select(CaseComment, Case).outerjoin(Case, CaseComment.case_id == Case.id)
                .where(CaseComment.id.in_(by_type["comment"]))
            ).all():
                out.append({"case_id": cm.case_id, "case_name": case.case_name if case else None,
                            "description": cm.content, "anchored_minutes": None})
    return out


# ---------------------------------------------------------------------------
# AI consolidation session
# ---------------------------------------------------------------------------

def create_processing_log(transcript: str, log_date: str, created_by: Optional[int],
                          selections: Optional[list[dict]] = None) -> int:
    """Insert a VoiceLog with status='processing'; record the selected source
    items (for already-logged flags). Returns its id."""
    day = _parse_date(log_date)
    with SessionLocal() as session:
        log = VoiceLog(transcript=transcript or None, log_date=day,
                       status="processing", created_by=created_by)
        session.add(log)
        session.flush()
        log_id = log.id
        seen: set[tuple] = set()
        for s in (selections or []):
            st, sid = s.get("source_type"), s.get("source_id")
            if st and isinstance(sid, int) and (st, sid) not in seen:
                seen.add((st, sid))
                session.add(VoiceLogSource(voice_log_id=log_id, source_type=st, source_id=sid))
        session.commit()
        return log_id


def set_worklog_status(voice_log_id: int, status: str, error: Optional[str] = None) -> None:
    with SessionLocal() as session:
        log = session.get(VoiceLog, voice_log_id)
        if not log:
            return
        log.status = status
        log.error = error
        session.commit()


def save_consolidated_entries(voice_log_id: int, entries: list[dict]) -> dict:
    """Write the AI's entries for a session and flip it to 'done'. Entries land
    live in the day immediately (no review gate)."""
    with SessionLocal() as session:
        log = session.get(VoiceLog, voice_log_id)
        if not log:
            return {}
        for old in session.execute(
            select(WorklogEntry).where(WorklogEntry.voice_log_id == voice_log_id)
        ).scalars():
            session.delete(old)
        session.flush()

        for e in entries:
            entry = WorklogEntry(
                voice_log_id=voice_log_id,
                case_id=e.get("case_id"),
                created_by=log.created_by,
                minutes=int(e.get("minutes") or 0),
                description=e.get("description") or "",
                raw_reference=e.get("raw_reference"),
                activity_date=log.log_date,
            )
            session.add(entry)
            session.flush()
            for pid in dict.fromkeys(e.get("person_ids") or []):
                session.add(WorklogEntryPerson(entry_id=entry.id, person_id=pid))

        log.status = "done"
        log.error = None
        session.commit()
    return get_worklog(voice_log_id) or {}


def get_worklog(voice_log_id: int) -> Optional[dict]:
    """Fetch a session + its entries (for polling the processing state)."""
    with SessionLocal() as session:
        log = session.get(VoiceLog, voice_log_id)
        if not log:
            return None
        entries = _load_entries(session, [e.id for e in session.execute(
            select(WorklogEntry.id).where(WorklogEntry.voice_log_id == voice_log_id)
        ).all()])
        return {
            "id": log.id,
            "transcript": log.transcript,
            "log_date": log.log_date.isoformat() if log.log_date else None,
            "status": log.status,
            "error": log.error,
            "created_by": log.created_by,
            "entries": entries,
        }


def delete_worklog(voice_log_id: int) -> bool:
    with SessionLocal() as session:
        log = session.get(VoiceLog, voice_log_id)
        if not log:
            return False
        session.delete(log)
        session.commit()
        return True


# ---------------------------------------------------------------------------
# Entry serialization + CRUD
# ---------------------------------------------------------------------------

def _load_entries(session, entry_ids: list[int]) -> list[dict]:
    """Serialize a set of entries (by id) with case, people, and author info."""
    if not entry_ids:
        return []
    rows = session.execute(
        select(WorklogEntry)
        .where(WorklogEntry.id.in_(entry_ids))
        .options(selectinload(WorklogEntry.people))
        .order_by(WorklogEntry.id)
    ).scalars().all()

    case_ids = {e.case_id for e in rows if e.case_id}
    cases = {c.id: c for c in session.execute(select(Case).where(Case.id.in_(case_ids))).scalars()} if case_ids else {}
    person_ids = {pp.person_id for e in rows for pp in e.people}
    persons = {p.id: p for p in session.execute(select(Person).where(Person.id.in_(person_ids))).scalars()} if person_ids else {}
    author_ids = {e.created_by for e in rows if e.created_by}
    authors = {u.id: u for u in session.execute(select(User).where(User.id.in_(author_ids))).scalars()} if author_ids else {}

    out = []
    for e in rows:
        case = cases.get(e.case_id)
        author = authors.get(e.created_by)
        out.append({
            "id": e.id,
            "voice_log_id": e.voice_log_id,
            "case_id": e.case_id,
            "case_name": case.case_name if case else None,
            "short_name": case.short_name if case else None,
            "minutes": e.minutes,
            "description": e.description,
            "raw_reference": e.raw_reference,
            "activity_date": e.activity_date.isoformat() if e.activity_date else None,
            "created_at": e.created_at.isoformat() if e.created_at else None,
            "author_id": e.created_by,
            "author_initials": author.initials if author else None,
            "people": [{"id": persons[pp.person_id].id, "name": persons[pp.person_id].name}
                       for pp in e.people if pp.person_id in persons],
        })
    return out


def _set_entry_people(session, entry_id: int, person_ids: list[int]) -> None:
    for old in session.execute(
        select(WorklogEntryPerson).where(WorklogEntryPerson.entry_id == entry_id)
    ).scalars():
        session.delete(old)
    session.flush()
    for pid in dict.fromkeys(person_ids or []):
        session.add(WorklogEntryPerson(entry_id=entry_id, person_id=pid))


def add_manual_entry(log_date: str, created_by: Optional[int], case_id: Optional[int],
                     minutes: int, description: str, person_ids: list[int]) -> dict:
    """Add a standalone (non-AI) entry directly to a day's ledger."""
    day = _parse_date(log_date)
    with SessionLocal() as session:
        entry = WorklogEntry(
            voice_log_id=None,
            case_id=case_id,
            created_by=created_by,
            minutes=max(0, int(minutes or 0)),
            description=description or "",
            raw_reference=None,
            activity_date=day,
        )
        session.add(entry)
        session.flush()
        for pid in dict.fromkeys(person_ids or []):
            session.add(WorklogEntryPerson(entry_id=entry.id, person_id=pid))
        eid = entry.id
        session.commit()
        return _load_entries(session, [eid])[0]


def update_worklog_entry(entry_id: int, fields: dict, user_id: Optional[int]) -> Optional[dict]:
    """Patch an entry (case_id, minutes, description, person_ids). Works on any
    day, but only on the caller's own entries (returns None otherwise)."""
    with SessionLocal() as session:
        entry = session.get(WorklogEntry, entry_id)
        if not entry or entry.created_by != user_id:
            return None
        if "case_id" in fields:
            entry.case_id = fields["case_id"]
        if "minutes" in fields and fields["minutes"] is not None:
            entry.minutes = max(0, int(fields["minutes"]))
        if "description" in fields and fields["description"] is not None:
            entry.description = fields["description"]
        if "person_ids" in fields and fields["person_ids"] is not None:
            _set_entry_people(session, entry_id, fields["person_ids"])
        session.flush()
        session.commit()
        return _load_entries(session, [entry_id])[0]


def delete_worklog_entry(entry_id: int, user_id: Optional[int]) -> bool:
    """Delete the caller's own entry (no-op for others' entries)."""
    with SessionLocal() as session:
        entry = session.get(WorklogEntry, entry_id)
        if not entry or entry.created_by != user_id:
            return False
        session.delete(entry)
        session.commit()
        return True


# ---------------------------------------------------------------------------
# Day ledger + views
# ---------------------------------------------------------------------------

def get_worklog_day(log_date: str, user_id: Optional[int]) -> dict:
    """The user's ledger for a day: entries earliest->latest, a total, and any
    in-flight consolidation ids (so the UI can show 'working on it')."""
    day = _parse_date(log_date)
    with SessionLocal() as session:
        entry_stmt = select(WorklogEntry.id).where(WorklogEntry.activity_date == day)
        log_stmt = select(VoiceLog.id).where(
            VoiceLog.log_date == day, VoiceLog.status == "processing"
        )
        if user_id:
            entry_stmt = entry_stmt.where(WorklogEntry.created_by == user_id)
            log_stmt = log_stmt.where(VoiceLog.created_by == user_id)
        else:
            entry_stmt = entry_stmt.where(WorklogEntry.created_by.is_(None))
            log_stmt = log_stmt.where(VoiceLog.created_by.is_(None))

        entry_stmt = entry_stmt.order_by(WorklogEntry.id)
        entry_ids = [r.id for r in session.execute(entry_stmt).all()]
        entries = _load_entries(session, entry_ids)
        processing_ids = [r.id for r in session.execute(log_stmt).all()]

    return {
        "date": day.isoformat(),
        "total_minutes": sum(e["minutes"] or 0 for e in entries),
        "entries": entries,
        "processing_ids": processing_ids,
    }


def get_worklog_by_case(case_id: int) -> dict:
    """All worklog entries for a case, grouped by day (newest first), with a
    total. Firm-wide: each entry carries its author's initials."""
    with SessionLocal() as session:
        entry_ids = [r.id for r in session.execute(
            select(WorklogEntry.id)
            .where(WorklogEntry.case_id == case_id)
            .order_by(WorklogEntry.activity_date.desc(), WorklogEntry.id)
        ).all()]
        entries = _load_entries(session, entry_ids)

    # Group by date, preserving newest-first order.
    total = 0
    groups: dict[str, dict] = {}
    for e in sorted(entries, key=lambda x: (x["activity_date"] or "", x["id"]), reverse=True):
        total += e["minutes"] or 0
        key = e["activity_date"] or "unknown"
        g = groups.setdefault(key, {"date": key, "minutes": 0, "entries": []})
        g["minutes"] += e["minutes"] or 0
        g["entries"].append({
            "id": e["id"],
            "minutes": e["minutes"],
            "description": e["description"],
            "author_id": e["author_id"],
            "author_initials": e["author_initials"],
            "people": e["people"],
        })
    return {"case_id": case_id, "total_minutes": total, "days": list(groups.values())}


def get_worklog_by_person(person_id: int) -> dict:
    """All worklog entries naming a person, newest first, with case info."""
    with SessionLocal() as session:
        entry_ids = [r.id for r in session.execute(
            select(WorklogEntry.id)
            .join(WorklogEntryPerson, WorklogEntryPerson.entry_id == WorklogEntry.id)
            .where(WorklogEntryPerson.person_id == person_id)
            .order_by(WorklogEntry.activity_date.desc(), WorklogEntry.id)
        ).all()]
        entries = _load_entries(session, entry_ids)

    entries.sort(key=lambda x: (x["activity_date"] or "", x["id"]), reverse=True)
    total = sum(e["minutes"] or 0 for e in entries)
    return {
        "person_id": person_id,
        "total_minutes": total,
        "entries": [{
            "id": e["id"], "minutes": e["minutes"], "description": e["description"],
            "activity_date": e["activity_date"], "case_id": e["case_id"],
            "case_name": e["case_name"], "short_name": e["short_name"],
        } for e in entries],
    }
