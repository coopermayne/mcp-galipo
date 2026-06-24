"""
Worklog consolidation service.

Background-thread AI job that turns a lawyer's day (a free-text memo + selected
surfaced items) into discrete, time-estimated work-log entries linked to cases
and people. Mirrors services/intake_ai.py for the async pattern and
services/case_extractor.py for the forced-tool LLM call.

This is NOT a precise time tracker — it produces broad-strokes estimates (in
decimal hours) that add up to a believable working day (~5–7h, hard ceiling ~7h).
"""

import logging
import os
from typing import Optional

from anthropic import Anthropic
from sqlalchemy import select, or_, cast
from sqlalchemy import ARRAY as SA_ARRAY, Integer

import db
from db.session import SessionLocal
from db.token_usage import record_usage_from_message
from models import Case, Person, PersonRole

logger = logging.getLogger(__name__)

CLOSED_STATUSES = ("Closed",)

SUBMIT_WORKLOG_TOOL = {
    "name": "submit_worklog",
    "description": "Submit the consolidated work-log entries for the day.",
    "input_schema": {
        "type": "object",
        "properties": {
            "entries": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "description": {
                            "type": "string",
                            "description": "Concise summary of the work done.",
                        },
                        "hours": {
                            "type": "number",
                            "description": "Estimated hours spent on this activity, in decimal hours (0.1 = 6 minutes, 0.5 = 30 minutes). Use tenth-of-an-hour increments.",
                        },
                        "case_id": {
                            "type": ["integer", "null"],
                            "description": "Matched case id, or null if no confident match.",
                        },
                        "case_guess": {
                            "type": "string",
                            "description": "How the user referred to the case (for unmatched display).",
                        },
                        "person_ids": {
                            "type": "array",
                            "items": {"type": "integer"},
                            "description": "Matched person ids named in this activity.",
                        },
                        "raw_reference": {
                            "type": "string",
                            "description": "The original phrasing for this activity.",
                        },
                    },
                    "required": ["description", "hours", "raw_reference"],
                },
            }
        },
        "required": ["entries"],
    },
}

SYSTEM_PROMPT = """You convert a lawyer's day into discrete work-log entries.

INPUTS:
- Selected items already on record (events, completed tasks, case comments), each with a
  case, a description, and sometimes an anchored duration. MERGE these in as activities —
  smash each item's context into the unified entry format. A comment represents work that
  took time (a call, a review, a follow-up).
- A free-text memo of everything else.
- Candidate cases and contacts to match against.

STEP 1 — SPLIT & MERGE: Break the memo into separate activities (one activity = one case),
and fold each selected item in as its own activity. Combine details where they describe the
same piece of work.

STEP 2 — ESTIMATE DURATIONS (in decimal hours, tenth-of-an-hour increments — 0.1 = 6 min):
- Events with a real start/end time keep that length (anchored).
- A comment/call with no stated length is about 0.5 hours (longer if the text implies more).
- TASKS: estimate from the description and typical legal effort (quick filing vs. drafting a
  brief). Use judgment; do NOT use one rigid number.
- Free-text work: estimate from cues ("spent the morning" = a substantial block).

STEP 3 — FIT THE DAY: The total across ALL entries must read like a realistic working day,
roughly 5-7 hours, and MUST NOT exceed 7 hours. Anchored items keep their
lengths; flexible work absorbs the remainder and is scaled to fit. If anchored items alone
exceed 7h, keep them accurate and let the total exceed — the user will adjust. Never pad with
invented activities; only distribute time across what's given.

STEP 4 — MATCH each activity to a case (fuzzy by name). No confident case match -> case_id=null,
put the user's phrasing in case_guess. ALWAYS fill raw_reference.
- EXPLICITLY TAGGED CASES: if that list is provided, the user picked those cases by name and
  their exact case_name appears verbatim in the memo. When an activity's text contains a tagged
  case's name, you MUST use that exact case_id — do not second-guess or leave it null.

PEOPLE: Only tag a person when they are EXPLICITLY NAMED or clearly referenced in that activity's
text (e.g. "call with Tanner Navaroli", "met opposing counsel Jane Doe"). Match the named person
to the candidate list and use their id. Do NOT tag people just because they are associated with the
case — an activity like "drafted the opposition" or "reviewed body cam footage" names no one, so
person_ids must be empty. When in doubt, leave it empty. A generic role with no name ("called
opposing counsel") is NOT a tag unless the candidate list has that exact named person.

Use the submit_worklog tool; entries in chronological order."""


def _gather_candidates(user_id: Optional[int]) -> tuple[list[dict], list[dict]]:
    """Candidate cases (the user's open cases, or all open) + the people linked
    to them — kept lean for matching."""
    with SessionLocal() as session:
        case_stmt = (
            select(Case.id, Case.case_name, Case.short_name)
            .where(Case.status.notin_(CLOSED_STATUSES))
        )
        if user_id:
            uid_arr = cast([user_id], SA_ARRAY(Integer()))
            scoped = case_stmt.where(or_(
                Case.attorney_ids.op('@>')(uid_arr),
                Case.paralegal_ids.op('@>')(uid_arr),
            ))
            rows = session.execute(scoped).all()
            if not rows:  # fall back to all open cases when the user owns none
                rows = session.execute(case_stmt).all()
        else:
            rows = session.execute(case_stmt).all()

        cases = [
            {"id": r.id, "case_name": r.case_name, "short_name": r.short_name}
            for r in rows
        ]
        case_ids = [c["id"] for c in cases]

        people: list[dict] = []
        if case_ids:
            people_rows = session.execute(
                select(Person.id, Person.name, PersonRole.case_id)
                .join(PersonRole, PersonRole.person_id == Person.id)
                .where(PersonRole.case_id.in_(case_ids))
                .distinct()
            ).all()
            seen: set[int] = set()
            for r in people_rows:
                if r.id in seen:
                    continue
                seen.add(r.id)
                people.append({"id": r.id, "name": r.name, "case_id": r.case_id})

    return cases, people


def _load_cases_by_ids(ids: list[int]) -> list[dict]:
    """Fetch specific cases by id (used to fold @-tagged cases into the
    candidate list even when they fall outside the user's own caseload)."""
    if not ids:
        return []
    with SessionLocal() as session:
        rows = session.execute(
            select(Case.id, Case.case_name, Case.short_name).where(Case.id.in_(ids))
        ).all()
    return [{"id": r.id, "case_name": r.case_name, "short_name": r.short_name} for r in rows]


def _build_user_content(transcript: str, log_date: str, selected: list[dict],
                        cases: list[dict], people: list[dict],
                        tagged: list[dict]) -> str:
    import json
    parts = [f"DATE: {log_date}", ""]
    if tagged:
        parts.append("EXPLICITLY TAGGED CASES (user @-mentioned these — trust these ids when "
                     "the activity names the case):")
        parts.append(json.dumps(tagged, ensure_ascii=False))
        parts.append("")
    parts.append("SELECTED ITEMS ALREADY ON RECORD (merge these in):")
    if selected:
        for s in selected:
            anchored = f" [~{s['anchored_hours']}h]" if s.get("anchored_hours") else ""
            cname = s.get("case_name") or "(no case)"
            parts.append(f"- [{cname}]{anchored} {s['description']}")
    else:
        parts.append("(none)")
    parts.append("")
    parts.append("FREE-TEXT MEMO:")
    parts.append(transcript.strip() or "(none)")
    parts.append("")
    parts.append("CANDIDATE CASES (match by name; use the id):")
    parts.append(json.dumps(cases, ensure_ascii=False))
    parts.append("")
    parts.append("CANDIDATE PEOPLE (match names; use the id):")
    parts.append(json.dumps(people, ensure_ascii=False))
    return "\n".join(parts)


def _consolidate_with_claude(transcript: str, log_date: str, selected: list[dict],
                             cases: list[dict], people: list[dict],
                             mentioned_case_ids: Optional[list[int]] = None) -> list[dict]:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY environment variable is required")
    from config import settings
    client = Anthropic(api_key=api_key)
    model = settings.chat_model_full

    # Resolve the user's @-tagged ids to {id, case_name} hints (only ids that are
    # real, open candidate cases survive).
    tagged_ids = set(mentioned_case_ids or [])
    tagged = [{"id": c["id"], "case_name": c["case_name"]}
              for c in cases if c["id"] in tagged_ids]

    message = client.messages.create(
        model=model,
        max_tokens=2048,
        system=SYSTEM_PROMPT,
        tools=[SUBMIT_WORKLOG_TOOL],
        tool_choice={"type": "tool", "name": "submit_worklog"},
        messages=[{
            "role": "user",
            "content": _build_user_content(transcript, log_date, selected, cases, people, tagged),
        }],
    )
    record_usage_from_message(
        source="worklog_consolidator", request_type="consolidate",
        model=model, message=message,
    )

    raw_entries = None
    for block in message.content:
        if block.type == "tool_use" and block.name == "submit_worklog":
            raw_entries = block.input.get("entries", [])
            break
    if raw_entries is None:
        raise ValueError("Consolidation failed - no submit_worklog tool call received")

    valid_case_ids = {c["id"] for c in cases}
    valid_person_ids = {p["id"] for p in people}

    entries: list[dict] = []
    for e in raw_entries:
        case_id = e.get("case_id")
        if case_id is not None and case_id not in valid_case_ids:
            case_id = None  # hallucinated id -> unmatched
        # Preserve the user's phrasing; prefer raw_reference, fall back to case_guess.
        raw_reference = e.get("raw_reference") or e.get("case_guess")
        person_ids = [pid for pid in (e.get("person_ids") or []) if pid in valid_person_ids]
        entries.append({
            "case_id": case_id,
            "hours": max(0.0, round(float(e.get("hours") or 0), 2)),
            "description": (e.get("description") or "").strip(),
            "raw_reference": raw_reference,
            "person_ids": person_ids,
        })
    return entries


def run_worklog_consolidation(voice_log_id: int, transcript: str, log_date: str,
                              selections: list[dict], user_id: Optional[int],
                              mentioned_case_ids: Optional[list[int]] = None) -> None:
    """Background-thread entry point. Resolves selections, gathers candidates,
    calls Claude, writes entries (status -> 'ready'). On error -> 'failed'.
    Mirrors services/intake_ai.py:run_background_analysis."""
    from routes.sse import broadcast
    try:
        selected = db.resolve_selection_context(selections, user_id)
        cases, people = _gather_candidates(user_id)
        # Fold any @-tagged cases that aren't already candidates (e.g. outside
        # the user's own caseload) so the AI can match them by their exact id.
        if mentioned_case_ids:
            have = {c["id"] for c in cases}
            cases = cases + _load_cases_by_ids([i for i in mentioned_case_ids if i not in have])
        entries = _consolidate_with_claude(transcript, log_date, selected, cases, people,
                                           mentioned_case_ids)
        db.save_consolidated_entries(voice_log_id, entries)
        try:
            broadcast({"entity": "worklog", "action": "ready", "id": voice_log_id})
        except Exception:
            logger.exception("broadcast failed for worklog %d", voice_log_id)
    except Exception as e:
        logger.exception("Worklog consolidation failed for log %d", voice_log_id)
        try:
            db.set_worklog_status(voice_log_id, "failed", error=str(e))
            broadcast({"entity": "worklog", "action": "failed", "id": voice_log_id})
        except Exception:
            logger.exception("Failed to mark worklog %d failed", voice_log_id)
