"""
Worklog (voice-driven work log) data layer.

A VoiceLog is one logging session: a raw memo for a day, consolidated by AI
into time-estimated WorklogEntry rows. Lifecycle:
    'processing' -> 'ready' -> 'confirmed'   ('failed' on error)
Only 'confirmed' entries count toward case/contact totals.

Mirrors db/notes.py (SessionLocal ctx mgr, dict returns) and db/intakes.py
(status helpers for the background AI job).
"""

import datetime
from typing import Optional

from sqlalchemy import select, func, cast, or_
from sqlalchemy import ARRAY as SA_ARRAY, Integer
from sqlalchemy.orm import selectinload

from .session import SessionLocal
from models import (
    VoiceLog,
    WorklogEntry,
    WorklogEntryPerson,
    Case,
    Event,
    Task,
    CaseComment,
    Person,
    User,
)

# Task statuses that count as "finished work" for the updated-that-day candidate.
TERMINAL_TASK_STATUSES = ("Done",)


def _parse_date(s: Optional[str]) -> datetime.date:
    """Parse YYYY-MM-DD, defaulting to today (Pacific) when missing."""
    if not s:
        from lib.tz import today_la
        return today_la()
    return datetime.date.fromisoformat(s)


# ---------------------------------------------------------------------------
# Phase 1 — surfaced candidates
# ---------------------------------------------------------------------------

def _changed_to_terminal_today(day: datetime.date):
    """Predicate: task moved to a terminal status on `day` (Pacific)."""
    return (
        Task.status.in_(TERMINAL_TASK_STATUSES)
        & (func.date(func.timezone("America/Los_Angeles", Task.updated_at)) == day)
    )


def get_worklog_candidates(log_date: str, user_id: Optional[int]) -> dict:
    """Surface things already on record for `log_date`, scoped to the user's
    cases: calendar events, tasks finished that day, and the user's own
    (non-system) case comments. Returns {"events", "tasks", "comments"} lists of
    candidate dicts. source_type/source_id are used only to fetch context during
    consolidation — they are never stored on entries.
    """
    day = _parse_date(log_date)
    uid_arr = cast([user_id], SA_ARRAY(Integer())) if user_id else None

    def case_scope(stmt):
        # Events/tasks belong to a case; scope to the user's cases (or unowned).
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
        # Events on the date.
        ev_stmt = case_scope(
            select(Event, Case)
            .join(Case, Event.case_id == Case.id)
            .where(Event.date == day)
            .order_by(Event.time.is_(None), Event.time)
        )
        for ev, case in session.execute(ev_stmt).all():
            # Anchor a duration only when the event has an explicit end_date is
            # not available here (events are single-day with a time); leave None
            # so the AI estimates, unless a time is present (treat as ~1h slot).
            events.append({
                "source_type": "event",
                "source_id": ev.id,
                "case_id": ev.case_id,
                "case_name": case.case_name if case else None,
                "short_name": case.short_name if case else None,
                "description": ev.description,
                "anchored_minutes": 60 if ev.time is not None else None,
                "when": ev.time.strftime("%-I:%M %p") if ev.time else (ev.event_type or None),
            })

        # Tasks finished that day: completed on the date, or status-changed to a
        # terminal status on the date. Labeled so the UI can distinguish.
        task_stmt = case_scope(
            select(Task, Case)
            .join(Case, Task.case_id == Case.id)
            .where(or_(
                Task.completion_date == day,
                _changed_to_terminal_today(day),
            ))
            .order_by(Task.updated_at)
        )
        seen_task_ids: set[int] = set()
        for tk, case in session.execute(task_stmt).all():
            if tk.id in seen_task_ids:
                continue
            seen_task_ids.add(tk.id)
            completed = tk.completion_date == day
            tasks.append({
                "source_type": "task",
                "source_id": tk.id,
                "case_id": tk.case_id,
                "case_name": case.case_name if case else None,
                "short_name": case.short_name if case else None,
                "description": tk.description,
                "anchored_minutes": None,
                "when": "completed" if completed else "updated",
            })

        # The user's own non-system case comments created that day.
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
            comments.append({
                "source_type": "comment",
                "source_id": cm.id,
                "case_id": cm.case_id,
                "case_name": case.case_name if case else None,
                "short_name": case.short_name if case else None,
                "description": cm.content,
                "anchored_minutes": None,
                "when": None,
            })

    return {"events": events, "tasks": tasks, "comments": comments}


def resolve_selection_context(selections: list[dict], user_id: Optional[int]) -> list[dict]:
    """Resolve [{source_type, source_id}] to text/case/duration for the AI.
    Used by the consolidator; not exposed via a route."""
    out: list[dict] = []
    if not selections:
        return out
    by_type: dict[str, list[int]] = {"event": [], "task": [], "comment": []}
    for s in selections:
        st = s.get("source_type")
        sid = s.get("source_id")
        if st in by_type and isinstance(sid, int):
            by_type[st].append(sid)

    with SessionLocal() as session:
        if by_type["event"]:
            rows = session.execute(
                select(Event, Case).outerjoin(Case, Event.case_id == Case.id)
                .where(Event.id.in_(by_type["event"]))
            ).all()
            for ev, case in rows:
                out.append({
                    "case_id": ev.case_id,
                    "case_name": case.case_name if case else None,
                    "description": ev.description,
                    "anchored_minutes": 60 if ev.time is not None else None,
                })
        if by_type["task"]:
            rows = session.execute(
                select(Task, Case).outerjoin(Case, Task.case_id == Case.id)
                .where(Task.id.in_(by_type["task"]))
            ).all()
            for tk, case in rows:
                out.append({
                    "case_id": tk.case_id,
                    "case_name": case.case_name if case else None,
                    "description": tk.description,
                    "anchored_minutes": None,
                })
        if by_type["comment"]:
            rows = session.execute(
                select(CaseComment, Case).outerjoin(Case, CaseComment.case_id == Case.id)
                .where(CaseComment.id.in_(by_type["comment"]))
            ).all()
            for cm, case in rows:
                out.append({
                    "case_id": cm.case_id,
                    "case_name": case.case_name if case else None,
                    "description": cm.content,
                    "anchored_minutes": None,
                })
    return out


# ---------------------------------------------------------------------------
# Phase 2 — processing + consolidation
# ---------------------------------------------------------------------------

def create_processing_log(transcript: str, log_date: str, created_by: Optional[int]) -> int:
    """Insert a VoiceLog with status='processing'; return its id."""
    day = _parse_date(log_date)
    with SessionLocal() as session:
        log = VoiceLog(
            transcript=transcript or None,
            log_date=day,
            status="processing",
            created_by=created_by,
        )
        session.add(log)
        session.flush()
        log_id = log.id
        session.commit()
        return log_id


def set_worklog_status(voice_log_id: int, status: str, error: Optional[str] = None) -> None:
    """Set a log's status (mirrors db.set_ai_analyzing)."""
    with SessionLocal() as session:
        log = session.get(VoiceLog, voice_log_id)
        if not log:
            return
        log.status = status
        log.error = error
        session.commit()


def save_consolidated_entries(voice_log_id: int, entries: list[dict]) -> dict:
    """Replace a log's entries with the AI's consolidated set and flip to
    'ready'. entries: [{case_id|None, minutes, description, raw_reference,
    person_ids}]. Mirrors db.save_ai_analysis (writes results + clears flag)."""
    with SessionLocal() as session:
        log = session.get(VoiceLog, voice_log_id)
        if not log:
            return {}
        # Wipe any prior entries (re-run safety).
        for old in session.execute(
            select(WorklogEntry).where(WorklogEntry.voice_log_id == voice_log_id)
        ).scalars():
            session.delete(old)
        session.flush()

        for e in entries:
            entry = WorklogEntry(
                voice_log_id=voice_log_id,
                case_id=e.get("case_id"),
                minutes=int(e.get("minutes") or 0),
                description=e.get("description") or "",
                raw_reference=e.get("raw_reference"),
                activity_date=log.log_date,
            )
            session.add(entry)
            session.flush()
            for pid in dict.fromkeys(e.get("person_ids") or []):
                session.add(WorklogEntryPerson(entry_id=entry.id, person_id=pid))

        log.status = "ready"
        log.error = None
        session.commit()
    return get_worklog(voice_log_id) or {}


# ---------------------------------------------------------------------------
# Serialization helpers
# ---------------------------------------------------------------------------

def _entry_to_dict(entry: WorklogEntry, case: Optional[Case], people: list[Person]) -> dict:
    return {
        "id": entry.id,
        "voice_log_id": entry.voice_log_id,
        "case_id": entry.case_id,
        "case_name": case.case_name if case else None,
        "short_name": case.short_name if case else None,
        "minutes": entry.minutes,
        "description": entry.description,
        "raw_reference": entry.raw_reference,
        "activity_date": entry.activity_date.isoformat() if entry.activity_date else None,
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
        "people": [{"id": p.id, "name": p.name} for p in people],
    }


def _load_entries(session, voice_log_id: int) -> list[dict]:
    rows = session.execute(
        select(WorklogEntry)
        .where(WorklogEntry.voice_log_id == voice_log_id)
        .options(selectinload(WorklogEntry.people))
        .order_by(WorklogEntry.id)
    ).scalars().all()
    # Bulk-load cases + people names.
    case_ids = {e.case_id for e in rows if e.case_id}
    cases = {}
    if case_ids:
        cases = {
            c.id: c for c in session.execute(
                select(Case).where(Case.id.in_(case_ids))
            ).scalars()
        }
    person_ids = {pp.person_id for e in rows for pp in e.people}
    persons = {}
    if person_ids:
        persons = {
            p.id: p for p in session.execute(
                select(Person).where(Person.id.in_(person_ids))
            ).scalars()
        }
    out = []
    for e in rows:
        ppl = [persons[pp.person_id] for pp in e.people if pp.person_id in persons]
        out.append(_entry_to_dict(e, cases.get(e.case_id), ppl))
    return out


def _log_to_dict(session, log: VoiceLog, include_entries: bool = True) -> dict:
    author = session.get(User, log.created_by) if log.created_by else None
    d = {
        "id": log.id,
        "transcript": log.transcript,
        "log_date": log.log_date.isoformat() if log.log_date else None,
        "status": log.status,
        "error": log.error,
        "created_by": log.created_by,
        "created_by_name": f"{author.first_name} {author.last_name}".strip() if author else None,
        "created_by_initials": author.initials if author else None,
        "created_at": log.created_at.isoformat() if log.created_at else None,
        "confirmed_at": log.confirmed_at.isoformat() if log.confirmed_at else None,
        "entries": _load_entries(session, log.id) if include_entries else [],
    }
    return d


# ---------------------------------------------------------------------------
# Phase 2/3 — fetch, pending list, confirm, discard
# ---------------------------------------------------------------------------

def get_worklog(voice_log_id: int) -> Optional[dict]:
    """Fetch a log + its entries (for polling and review)."""
    with SessionLocal() as session:
        log = session.get(VoiceLog, voice_log_id)
        if not log:
            return None
        return _log_to_dict(session, log)


def list_pending_worklogs(user_id: Optional[int]) -> list[dict]:
    """Logs awaiting attention (processing or ready) — the 'needs review' list.
    Firm-wide; the small office shares one queue."""
    with SessionLocal() as session:
        logs = session.execute(
            select(VoiceLog)
            .where(VoiceLog.status.in_(("processing", "ready")))
            .order_by(VoiceLog.created_at.desc())
        ).scalars().all()
        return [_log_to_dict(session, log) for log in logs]


def confirm_worklog(
    voice_log_id: int,
    transcript: str,
    log_date: Optional[str],
    entries: list[dict],
) -> Optional[dict]:
    """Apply the user's edits, replace entries, set status='confirmed'."""
    with SessionLocal() as session:
        log = session.get(VoiceLog, voice_log_id)
        if not log:
            return None
        if transcript is not None:
            log.transcript = transcript or None
        if log_date:
            log.log_date = _parse_date(log_date)

        for old in session.execute(
            select(WorklogEntry).where(WorklogEntry.voice_log_id == voice_log_id)
        ).scalars():
            session.delete(old)
        session.flush()

        for e in entries:
            entry = WorklogEntry(
                voice_log_id=voice_log_id,
                case_id=e.get("case_id"),
                minutes=int(e.get("minutes") or 0),
                description=e.get("description") or "",
                raw_reference=e.get("raw_reference"),
                activity_date=log.log_date,
            )
            session.add(entry)
            session.flush()
            for pid in dict.fromkeys(e.get("person_ids") or []):
                session.add(WorklogEntryPerson(entry_id=entry.id, person_id=pid))

        log.status = "confirmed"
        log.confirmed_at = func.now()
        log.error = None
        session.commit()
        return get_worklog(voice_log_id)


def delete_worklog(voice_log_id: int) -> bool:
    """Discard a log and its entries."""
    with SessionLocal() as session:
        log = session.get(VoiceLog, voice_log_id)
        if not log:
            return False
        session.delete(log)
        session.commit()
        return True


# ---------------------------------------------------------------------------
# Views — confirmed-only, grouped
# ---------------------------------------------------------------------------

def get_worklog_by_case(case_id: int) -> dict:
    """Confirmed worklog entries for a case, grouped by activity_date, newest
    first, with a total. Firm-wide: each entry carries its author's initials."""
    with SessionLocal() as session:
        rows = session.execute(
            select(WorklogEntry, VoiceLog)
            .join(VoiceLog, WorklogEntry.voice_log_id == VoiceLog.id)
            .where(
                WorklogEntry.case_id == case_id,
                VoiceLog.status == "confirmed",
            )
            .options(selectinload(WorklogEntry.people))
            .order_by(WorklogEntry.activity_date.desc(), WorklogEntry.id)
        ).all()

        person_ids = {pp.person_id for e, _ in rows for pp in e.people}
        persons = {}
        if person_ids:
            persons = {
                p.id: p for p in session.execute(
                    select(Person).where(Person.id.in_(person_ids))
                ).scalars()
            }
        authors = {}
        author_ids = {log.created_by for _, log in rows if log.created_by}
        if author_ids:
            authors = {
                u.id: u for u in session.execute(
                    select(User).where(User.id.in_(author_ids))
                ).scalars()
            }

        total = 0
        groups: dict[str, dict] = {}
        for entry, log in rows:
            total += entry.minutes or 0
            key = entry.activity_date.isoformat() if entry.activity_date else "unknown"
            author = authors.get(log.created_by)
            item = {
                "id": entry.id,
                "minutes": entry.minutes,
                "description": entry.description,
                "author_initials": author.initials if author else None,
                "people": [
                    {"id": persons[pp.person_id].id, "name": persons[pp.person_id].name}
                    for pp in entry.people if pp.person_id in persons
                ],
            }
            g = groups.setdefault(key, {"date": key, "minutes": 0, "entries": []})
            g["minutes"] += entry.minutes or 0
            g["entries"].append(item)

        return {
            "case_id": case_id,
            "total_minutes": total,
            "days": list(groups.values()),
        }


def get_worklog_by_person(person_id: int) -> dict:
    """Confirmed worklog entries that name a person, newest first, with case
    info — the contact 'Interactions' view."""
    with SessionLocal() as session:
        rows = session.execute(
            select(WorklogEntry, VoiceLog)
            .join(VoiceLog, WorklogEntry.voice_log_id == VoiceLog.id)
            .join(WorklogEntryPerson, WorklogEntryPerson.entry_id == WorklogEntry.id)
            .where(
                WorklogEntryPerson.person_id == person_id,
                VoiceLog.status == "confirmed",
            )
            .order_by(WorklogEntry.activity_date.desc(), WorklogEntry.id)
        ).all()

        case_ids = {e.case_id for e, _ in rows if e.case_id}
        cases = {}
        if case_ids:
            cases = {
                c.id: c for c in session.execute(
                    select(Case).where(Case.id.in_(case_ids))
                ).scalars()
            }

        entries = []
        total = 0
        for entry, _log in rows:
            total += entry.minutes or 0
            case = cases.get(entry.case_id)
            entries.append({
                "id": entry.id,
                "minutes": entry.minutes,
                "description": entry.description,
                "activity_date": entry.activity_date.isoformat() if entry.activity_date else None,
                "case_id": entry.case_id,
                "case_name": case.case_name if case else None,
                "short_name": case.short_name if case else None,
            })

        return {
            "person_id": person_id,
            "total_minutes": total,
            "entries": entries,
        }
