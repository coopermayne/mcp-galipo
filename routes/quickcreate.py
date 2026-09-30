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

Duplicate guard (same idea as the MCP tools; see db/existing_items.py):
- The AI parse is given the case's existing tasks/events and sets existing_id
  when the note is about one of them. Then nothing is created ->
  {"status": "possible_duplicate", "draft": {...}, "matches": [<that item>]}.
- POST {kind, case_id, draft, update_id}      -> apply the draft's changed
                                                 fields to that existing item.
- POST {kind, case_id, draft, create_anyway}  -> create, skipping the check.
"""

import asyncio

from fastapi.responses import JSONResponse

import db
import auth
from db.comments import add_comment as add_entity_comment
from db.existing_items import existing_events, existing_tasks, field_differences, match_summary
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
        update_id = body.get("update_id")
        create_anyway = bool(body.get("create_anyway"))

        if kind not in ("task", "event"):
            return api_error("kind must be 'task' or 'event'", "BAD_REQUEST", 400)
        if not case_id:
            return api_error("case_id is required", "BAD_REQUEST", 400)

        user = auth.get_current_user(request)
        user_id = _get_db_user_id(user)

        # Draft path: the draft was produced by a prior parse (the user has now
        # supplied an event's date, or resolved a duplicate) — skip the AI.
        if isinstance(draft, dict):
            parsed = draft
        else:
            if not text:
                return api_error("text is required", "BAD_REQUEST", 400)
            from services.quick_create import parse_quick_item
            try:
                existing = await asyncio.to_thread(_existing_items, kind, int(case_id))
                parsed = await asyncio.to_thread(parse_quick_item, kind, text, existing)
            except Exception as e:  # AI/config failure — surface cleanly
                return api_error(f"Could not parse note: {e}", "PARSE_FAILED", 502)

        case_id = int(case_id)
        try:
            matched = None
            if parsed.get("existing_id") and not create_anyway and not update_id:
                items = await asyncio.to_thread(_existing_items, kind, case_id)
                matched = next((i for i in items if i["id"] == parsed["existing_id"]), None)
            # A note like "move the mediation to 10am" matches an event but
            # gives no date — keep the existing one.
            if kind == "event" and not parsed.get("date") and matched:
                parsed = {**parsed, "date": matched["date"]}
            # event: needs a date before we can create one
            if kind == "event" and not parsed.get("date"):
                return JSONResponse({"status": "needs_date", "draft": parsed})
            if update_id:
                if kind == "task":
                    return await _update_task(case_id, int(update_id), parsed, user, user_id)
                return await _update_event(case_id, int(update_id), parsed, user, user_id)
            if matched:
                return JSONResponse({
                    "status": "possible_duplicate", "kind": kind, "draft": parsed,
                    "matches": [match_summary(matched, _comparable_fields(kind, parsed))],
                })
            if kind == "task":
                return await _create_task(case_id, parsed, user, user_id)
            return await _create_event(case_id, parsed, user, user_id)
        except db.FeatureDisabled as e:
            return feature_disabled_error(e)
        except (DbValidationError, ValueError) as e:
            return api_error(str(e), "VALIDATION_ERROR", 400)


def _existing_items(kind, case_id):
    return existing_tasks(case_id=case_id) if kind == "task" else existing_events(case_id)


def _comparable_fields(kind, parsed):
    """The draft fields worth showing as old → new against the matched item."""
    if kind == "task":
        # The parser defaults urgency to Medium when the note doesn't say, so
        # Medium alone isn't evidence of a change.
        urgency = parsed.get("urgency")
        return {
            "due_date": parsed.get("due_date"),
            "urgency": urgency if urgency != "Medium" else None,
            "assignee_id": parsed.get("assignee_id"),
        }
    return {
        "date": parsed.get("date"),
        "time": parsed.get("time"),
        "location": parsed.get("location"),
    }


def _user_name(user):
    return f"{user['firstName']} {user['lastName']}" if user else None


def _short(desc):
    return desc[:80] + ("..." if len(desc) > 80 else "")


def _change_summary(changes):
    return ", ".join(f'{f.replace("_", " ")} {d["existing"] or "none"} → {d["new"]}' for f, d in changes.items())


async def _update_task(case_id, task_id, parsed, user, user_id):
    existing = await asyncio.to_thread(db.get_task_detail, task_id)
    if not existing or existing.get("case_id") != case_id:
        return api_error("Task not found on this case", "NOT_FOUND", 404)

    changes = field_differences(existing, _comparable_fields("task", parsed))
    result = existing
    if changes:
        result = await asyncio.to_thread(
            db.update_task_full, task_id, **{f: d["new"] for f, d in changes.items()},
        )
        if name := _user_name(user):
            summary = _change_summary(changes)
            await asyncio.to_thread(
                add_entity_comment, "task", task_id, user_id,
                f"{name} updated this task ({summary})", True,
            )
            await asyncio.to_thread(
                db.add_case_comment, case_id, user_id,
                f'{name} updated task: "{_short(result["description"])}" ({summary})', True,
            )
        broadcast({"entity": "task", "action": "updated", "id": task_id, "case_id": case_id})
    return JSONResponse({"status": "updated", "kind": "task", "task": result, "changes": changes})


async def _update_event(case_id, event_id, parsed, user, user_id):
    existing = await asyncio.to_thread(db.get_event_by_id, event_id)
    if not existing or existing.get("case_id") != case_id:
        return api_error("Event not found on this case", "NOT_FOUND", 404)

    changes = field_differences(existing, _comparable_fields("event", parsed))
    updates = {f: d["new"] for f, d in changes.items()}
    # Fill, never overwrite, the softer fields.
    if parsed.get("event_type") and not existing.get("event_type"):
        updates["event_type"] = parsed["event_type"]
    note = parsed.get("notes")
    if note and note not in (existing.get("notes") or ""):
        updates["notes"] = f'{existing["notes"]}\n{note}' if existing.get("notes") else note

    result = existing
    if updates:
        result = await asyncio.to_thread(db.update_event_full, event_id, **updates)
    new_attendees = set(parsed.get("attendee_ids") or []) - set(existing.get("attendee_ids") or [])
    for uid in new_attendees:
        try:
            await asyncio.to_thread(db.add_event_attendee, event_id, int(uid))
        except Exception:
            pass  # a bad id shouldn't sink the update

    if updates or new_attendees:
        if (name := _user_name(user)) and changes:
            await asyncio.to_thread(
                db.add_case_comment, case_id, user_id,
                f'{name} updated event: "{_short(result["description"])}" ({_change_summary(changes)})', True,
            )
        broadcast({"entity": "event", "action": "updated", "id": event_id, "case_id": case_id})
    return JSONResponse({"status": "updated", "kind": "event", "event": result, "changes": changes})


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
