"""
Quick-create service.

A single, synchronous Claude call (forced tool use) that turns a short
natural-language note into ONE task or event for a *known* case. The case is
already chosen by the caller (the highlighted quick-search result), so unlike
the worklog consolidator there is no case matching — only field extraction.

Deliberate product rules (do NOT relax these):
- Never ask follow-up questions.
- A task with no date  -> due_date = null (just create it).
- An event with no date -> the route returns ``needs_date`` and asks ONLY for
  the date; this service simply leaves ``date`` null when it can't resolve one.
- Relative dates ("next Tuesday", "in 3 days") are resolved against TODAY,
  which is passed in (Pacific calendar date).

Mirrors services/worklog_consolidator.py for the forced-tool LLM pattern.
"""

import json
import logging
import os
import re
from datetime import date, timedelta

from anthropic import Anthropic

from db.token_usage import record_usage_from_message
from db.users import get_all_users
from lib.tz import today_la

logger = logging.getLogger(__name__)

URGENCY_VALUES = ["Low", "Medium", "High", "Urgent"]
EVENT_TYPE_HINT = (
    "trial, oral_argument, hearing, mediation, deposition, conference, "
    "vacation, holiday, other"
)

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_TIME_RE = re.compile(r"^\d{2}:\d{2}$")

TASK_TOOL = {
    "name": "submit_task",
    "description": "Create a single task from the user's note.",
    "input_schema": {
        "type": "object",
        "properties": {
            "description": {
                "type": "string",
                "description": (
                    "Concise task title in imperative form (e.g. 'Draft MSJ "
                    "response'). Do NOT include the case name — the case is "
                    "recorded separately."
                ),
            },
            "due_date": {
                "type": ["string", "null"],
                "description": (
                    "Due date as YYYY-MM-DD, resolved against TODAY. Null if the "
                    "note gives no date — never invent one."
                ),
            },
            "urgency": {
                "type": "string",
                "enum": URGENCY_VALUES,
                "description": "Urgency inferred from the note's tone. Default 'Medium'.",
            },
            "assignee_id": {
                "type": ["integer", "null"],
                "description": (
                    "Id of the single staff member to assign, matched by name "
                    "against CANDIDATE STAFF. Null if no one is named."
                ),
            },
        },
        "required": ["description"],
    },
}

EVENT_TOOL = {
    "name": "submit_event",
    "description": "Create a single calendar event from the user's note.",
    "input_schema": {
        "type": "object",
        "properties": {
            "description": {
                "type": "string",
                "description": (
                    "Concise event title (e.g. 'Deposition of plaintiff'). Do "
                    "NOT include the case name."
                ),
            },
            "date": {
                "type": ["string", "null"],
                "description": (
                    "Event date as YYYY-MM-DD, resolved against TODAY. Null if "
                    "the note gives no resolvable date — never invent one."
                ),
            },
            "time": {
                "type": ["string", "null"],
                "description": "Start time in 24-hour HH:MM (e.g. '10:00', '14:30'). Null if none.",
            },
            "location": {
                "type": ["string", "null"],
                "description": "Location if mentioned, else null.",
            },
            "notes": {
                "type": ["string", "null"],
                "description": "Any extra detail worth recording, else null.",
            },
            "event_type": {
                "type": ["string", "null"],
                "description": f"One of: {EVENT_TYPE_HINT}. Null if unclear.",
            },
            "attendee_ids": {
                "type": "array",
                "items": {"type": "integer"},
                "description": (
                    "Ids of staff attending, matched by name against CANDIDATE "
                    "STAFF. Empty if no one is named."
                ),
            },
        },
        "required": ["description"],
    },
}

_TASK_SYSTEM = (
    "You convert a short note into ONE task for a case the user already chose. "
    "Call submit_task exactly once. Never ask questions and never add commentary.\n"
    "- Write a concise imperative title; omit the case name.\n"
    "- Set due_date ONLY if the note implies one, resolving relative dates via "
    "the DATE REFERENCE table (never compute dates yourself); otherwise null.\n"
    "- Infer urgency from tone (default Medium).\n"
    "- Set assignee_id only when a CANDIDATE STAFF member is clearly named."
)

_EVENT_SYSTEM = (
    "You convert a short note into ONE calendar event for a case the user "
    "already chose. Call submit_event exactly once. Never ask questions and "
    "never add commentary.\n"
    "- Write a concise event title; omit the case name.\n"
    "- Resolve the date via the DATE REFERENCE table (never compute dates "
    "yourself). If the note gives no resolvable date, set date to null (the app "
    "will ask the user separately) — never guess.\n"
    "- Use 24-hour HH:MM for time.\n"
    "- Set attendee_ids only for CANDIDATE STAFF members clearly named."
)


def _staff_candidates() -> list[dict]:
    """Active attorneys/paralegals as {id, name} for assignment matching."""
    users = get_all_users(include_inactive=False)
    out = []
    for u in users:
        if u.get("position") not in ("attorney", "paralegal"):
            continue
        name = f"{u.get('first_name') or ''} {u.get('last_name') or ''}".strip()
        out.append({"id": u["id"], "name": name})
    return out


def _client_and_model():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY environment variable is required")
    from config import settings
    return Anthropic(api_key=api_key), settings.chat_model_full


def _date_reference(today: date, days: int = 21) -> str:
    """A precomputed calendar so the model never does its own date math.

    LLMs are unreliable at "what date is next Friday?". Python computes the
    weekday for each of the next `days` days; the model just looks the phrase up.
    """
    lines = []
    for i in range(days):
        d = today + timedelta(days=i)
        suffix = " (today)" if i == 0 else " (tomorrow)" if i == 1 else ""
        lines.append(f"{d.isoformat()} = {d.strftime('%A')}{suffix}")
    return "\n".join(lines)


def parse_quick_item(kind: str, text: str) -> dict:
    """Parse ``text`` into a single task/event dict for a known case.

    Returns the validated field dict (ids checked against real staff, dates and
    times normalised — anything malformed is dropped to null rather than raised).
    """
    if kind not in ("task", "event"):
        raise ValueError(f"Unknown quick-create kind: {kind}")

    staff = _staff_candidates()
    today = today_la()
    client, model = _client_and_model()

    tool = TASK_TOOL if kind == "task" else EVENT_TOOL
    system = _TASK_SYSTEM if kind == "task" else _EVENT_SYSTEM
    content = (
        f"TODAY: {today.isoformat()} ({today.strftime('%A')})\n\n"
        f"DATE REFERENCE — resolve every date by LOOKING IT UP here; never do "
        f"your own calendar arithmetic. Conventions: a bare or 'this <weekday>' "
        f"= the nearest such day after today; 'next <weekday>' = that day in the "
        f"following week; 'the <weekday> after next' = a further 7 days again:\n"
        f"{_date_reference(today)}\n\n"
        f"NOTE:\n{text.strip()}\n\n"
        f"CANDIDATE STAFF (match names; use the id):\n"
        f"{json.dumps(staff, ensure_ascii=False)}"
    )

    message = client.messages.create(
        model=model,
        max_tokens=1024,
        system=system,
        tools=[tool],
        tool_choice={"type": "tool", "name": tool["name"]},
        messages=[{"role": "user", "content": content}],
    )
    record_usage_from_message(
        source="quick_create", request_type=kind, model=model, message=message,
    )

    raw = None
    for block in message.content:
        if block.type == "tool_use" and block.name == tool["name"]:
            raw = block.input
            break
    if raw is None:
        raise ValueError("Quick-create failed - no tool call received")

    valid_staff_ids = {s["id"] for s in staff}
    description = (raw.get("description") or "").strip()
    if not description:
        raise ValueError("Quick-create produced an empty description")

    def _date(v):
        return v if isinstance(v, str) and _DATE_RE.match(v) else None

    def _time(v):
        return v if isinstance(v, str) and _TIME_RE.match(v) else None

    if kind == "task":
        urgency = raw.get("urgency")
        if urgency not in URGENCY_VALUES:
            urgency = "Medium"
        assignee_id = raw.get("assignee_id")
        if assignee_id not in valid_staff_ids:
            assignee_id = None
        return {
            "description": description,
            "due_date": _date(raw.get("due_date")),
            "urgency": urgency,
            "assignee_id": assignee_id,
        }

    attendee_ids = [i for i in (raw.get("attendee_ids") or []) if i in valid_staff_ids]
    return {
        "description": description,
        "date": _date(raw.get("date")),
        "time": _time(raw.get("time")),
        "location": (raw.get("location") or None),
        "notes": (raw.get("notes") or None),
        "event_type": (raw.get("event_type") or None),
        "attendee_ids": attendee_ids,
    }
