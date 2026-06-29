"""
Quick-create routes.

A single endpoint behind the quick-search bar's ⌃Enter / ⇧Enter shortcuts:
turn a short natural-language note into ONE task or event for the highlighted
case via a one-shot AI parse, then create it with the same side effects
(system comments + SSE broadcast) as the regular create routes.

Flow:
- POST {kind, case_id, text}        -> AI parse -> create (task), or
                                        create (event) when a date is found.
- An event with no resolvable date  -> {"status": "needs_date", "draft": {...}}.
- POST {kind:"event", case_id, draft}-> finalize the draft (date filled in by the
                                        user) and create — no AI call.
"""

import asyncio

from fastapi.responses import JSONResponse

import db
import auth
from db.comments import add_comment as add_entity_comment
from db.validation import ValidationError as DbValidationError
from .common import api_error, feature_disabled_error
from .comments import _get_db_user_id
from .sse import broadcast


def register_quickcreate_routes(mcp):
    """Register quick-create routes."""

    @mcp.custom_route("/api/v1/quick-create", methods=["POST"])
    async def api_quick_create(request):
        if err := auth.require_auth(request):
            return err

        body = await request.json()
        kind = body.get("kind")
        case_id = body.get("case_id")
        text = (body.get("text") or "").strip()
        draft = body.get("draft")

        if kind not in ("task", "event"):
            return api_error("kind must be 'task' or 'event'", "BAD_REQUEST", 400)
        if not case_id:
            return api_error("case_id is required", "BAD_REQUEST", 400)

        user = auth.get_current_user(request)
        user_id = _get_db_user_id(user)

        # Event finalize path: the draft was produced by a prior parse and the
        # user has now supplied the date — create directly, skip the AI.
        if kind == "event" and isinstance(draft, dict):
            parsed = draft
        else:
            if not text:
                return api_error("text is required", "BAD_REQUEST", 400)
            from services.quick_create import parse_quick_item
            try:
                parsed = await asyncio.to_thread(parse_quick_item, kind, text)
            except Exception as e:  # AI/config failure — surface cleanly
                return api_error(f"Could not parse note: {e}", "PARSE_FAILED", 502)

        try:
            if kind == "task":
                return await _create_task(int(case_id), parsed, user, user_id)
            # event: needs a date before we can create one
            if not parsed.get("date"):
                return JSONResponse({"status": "needs_date", "draft": parsed})
            return await _create_event(int(case_id), parsed, user, user_id)
        except db.FeatureDisabled as e:
            return feature_disabled_error(e)
        except (DbValidationError, ValueError) as e:
            return api_error(str(e), "VALIDATION_ERROR", 400)


async def _create_task(case_id, parsed, user, user_id):
    result = await asyncio.to_thread(
        db.add_task,
        case_id,
        parsed["description"],
        parsed.get("due_date"),
        "Pending",
        parsed.get("urgency") or "Medium",
        None,  # event_id
        parsed.get("assignee_id"),
        None,  # completion_date
        None,  # intake_id
    )
    task_id = result.get("id")

    # Mirror routes/tasks.py side effects so the list/activity update live.
    if user:
        name = f"{user['firstName']} {user['lastName']}"
        desc = parsed["description"][:80] + ("..." if len(parsed["description"]) > 80 else "")
        if task_id:
            await asyncio.to_thread(
                add_entity_comment, "task", task_id, user_id,
                f"{name} created this task", True,
            )
            broadcast({
                "entity": "comment", "action": "created", "id": None,
                "entity_type": "task", "entity_id": task_id, "user_id": user_id,
            })
        await asyncio.to_thread(
            db.add_case_comment, case_id, user_id, f'{name} added task: "{desc}"', True,
        )

    broadcast({"entity": "task", "action": "created", "id": task_id, "case_id": case_id})
    return JSONResponse({"status": "created", "kind": "task", "task": result})


async def _create_event(case_id, parsed, user, user_id):
    result = await asyncio.to_thread(
        db.add_event,
        case_id,
        parsed["date"],
        parsed["description"],
        None,  # document_link
        None,  # calculation_note
        parsed.get("time"),
        parsed.get("location"),
        False,  # starred
        parsed.get("event_type"),
        None,  # end_date
        False,  # blocks_calendar — case-scoped AI never blocks the calendar
        notes=parsed.get("notes"),
        on_trial_calendar=False,
    )
    event_id = result.get("id")

    # Attendees are a separate relation; add each matched staff member.
    for uid in (parsed.get("attendee_ids") or []):
        try:
            await asyncio.to_thread(db.add_event_attendee, event_id, int(uid))
        except Exception:
            pass  # a bad id shouldn't sink the whole event

    if user and case_id:
        name = f"{user['firstName']} {user['lastName']}"
        desc = parsed["description"][:80] + ("..." if len(parsed["description"]) > 80 else "")
        await asyncio.to_thread(
            db.add_case_comment, case_id, user_id, f'{name} added event: "{desc}"', True,
        )

    broadcast({"entity": "event", "action": "created", "id": event_id, "case_id": case_id})
    return JSONResponse({"status": "created", "kind": "event", "event": result})
