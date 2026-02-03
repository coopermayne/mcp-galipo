"""
Bulk case import - creates a case with all related entities in a single transaction.

Optimized for Claude AI to parse unstructured case summaries into structured JSON,
then import everything at once.
"""

import json
from typing import Optional
from .connection import get_connection, serialize_row
from .validation import (
    validate_case_status,
    validate_task_status,
    validate_urgency,
    validate_date_format,
    validate_time_format,
    validate_person_side,
    ValidationError,
    CASE_STATUSES,
    TASK_STATUSES,
)
from psycopg2.extras import RealDictCursor


def import_case(data: dict) -> dict:
    """
    Import a complete case with all related entities in a single transaction.

    Args:
        data: Dictionary with structure:
            {
                "case": { case fields },
                "persons": [ { person + role/side for case assignment } ],
                "proceedings": [ { case_number, jurisdiction, judge_name } ],
                "events": [ { event fields } ],
                "tasks": [ { task fields } ],
                "notes": [ { content } ],
                "activities": [ { activity fields } ]
            }

    Returns:
        Dictionary with all created IDs and a summary.
    """
    # Validate required fields
    case_data = data.get("case")
    if not case_data:
        raise ValidationError("case data is required")
    if not case_data.get("case_name"):
        raise ValidationError("case_name is required")

    # Validate case status if provided
    status = case_data.get("status", "Signing Up")
    if status not in CASE_STATUSES:
        raise ValidationError(f"Invalid case status '{status}'. Valid: {CASE_STATUSES}")

    # Validate dates
    if case_data.get("date_of_injury"):
        validate_date_format(case_data["date_of_injury"], "date_of_injury")

    # Track all created entities
    result = {
        "success": True,
        "case_id": None,
        "created": {
            "persons": [],
            "case_persons": [],
            "proceedings": [],
            "judges": [],
            "events": [],
            "tasks": [],
            "notes": [],
            "activities": [],
            "jurisdictions": [],
        },
        "summary": {}
    }

    # Use a single connection for the entire transaction
    with get_connection() as conn:
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            # 1. Create the case
            case_id = _create_case(cur, case_data)
            result["case_id"] = case_id

            # 2. Create persons and assign to case
            # Build a name -> person_id map for linking judges to proceedings
            person_name_map = {}
            persons_data = data.get("persons", [])
            for person_data in persons_data:
                person_result = _create_person_and_assign(cur, case_id, person_data)
                result["created"]["persons"].append({
                    "id": person_result["person_id"],
                    "name": person_data.get("name")
                })
                if person_result.get("case_person_id"):
                    result["created"]["case_persons"].append({
                        "id": person_result["case_person_id"],
                        "person_id": person_result["person_id"],
                        "role": person_data.get("role")
                    })
                # Track by name for judge linking
                person_name_map[person_data.get("name", "").lower().strip()] = person_result["person_id"]

            # 3. Create proceedings with judges
            proceedings_data = data.get("proceedings", [])
            for proc_data in proceedings_data:
                proc_result = _create_proceeding(cur, case_id, proc_data, person_name_map)
                result["created"]["proceedings"].append({
                    "id": proc_result["proceeding_id"],
                    "case_number": proc_data.get("case_number")
                })
                # Track any jurisdictions created
                if proc_result.get("jurisdiction_created"):
                    result["created"]["jurisdictions"].append(proc_result["jurisdiction_created"])
                # Track judges assigned
                for judge in proc_result.get("judges", []):
                    result["created"]["judges"].append(judge)

            # 4. Create events
            events_data = data.get("events", [])
            for event_data in events_data:
                event_id = _create_event(cur, case_id, event_data)
                result["created"]["events"].append({
                    "id": event_id,
                    "description": event_data.get("description")
                })

            # 5. Create tasks
            tasks_data = data.get("tasks", [])
            for task_data in tasks_data:
                task_id = _create_task(cur, case_id, task_data)
                result["created"]["tasks"].append({
                    "id": task_id,
                    "description": task_data.get("description")
                })

            # 6. Create notes
            notes_data = data.get("notes", [])
            for note_data in notes_data:
                note_id = _create_note(cur, case_id, note_data)
                result["created"]["notes"].append({"id": note_id})

            # 7. Create activities
            activities_data = data.get("activities", [])
            for activity_data in activities_data:
                activity_id = _create_activity(cur, case_id, activity_data)
                result["created"]["activities"].append({
                    "id": activity_id,
                    "description": activity_data.get("description")
                })

            # Build summary
            result["summary"] = {
                "case_name": case_data.get("case_name"),
                "persons_created": len(result["created"]["persons"]),
                "proceedings_created": len(result["created"]["proceedings"]),
                "events_created": len(result["created"]["events"]),
                "tasks_created": len(result["created"]["tasks"]),
                "notes_created": len(result["created"]["notes"]),
                "activities_created": len(result["created"]["activities"]),
            }

            # Commit happens automatically when context manager exits successfully

        except Exception as e:
            # Rollback happens automatically on exception
            raise ValidationError(f"Import failed: {str(e)}")
        finally:
            cur.close()

    return result


def _create_case(cur, case_data: dict) -> int:
    """Create a case and return its ID."""
    # Assign a color if not provided
    colors = ["blue", "emerald", "amber", "red", "violet", "pink", "cyan", "orange", "indigo", "teal"]

    # Get next color based on case count
    cur.execute("SELECT COUNT(*) FROM cases")
    count = cur.fetchone()["count"]
    color = case_data.get("color") or colors[count % len(colors)]

    cur.execute("""
        INSERT INTO cases (
            case_name, short_name, status, print_code, case_summary,
            result, date_of_injury, color
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (
        case_data.get("case_name"),
        case_data.get("short_name"),
        case_data.get("status", "Signing Up"),
        case_data.get("print_code"),
        case_data.get("case_summary"),
        case_data.get("result"),
        case_data.get("date_of_injury"),
        color
    ))
    return cur.fetchone()["id"]


def _create_person_and_assign(cur, case_id: int, person_data: dict) -> dict:
    """Create a person and optionally assign to the case."""
    result = {"person_id": None, "case_person_id": None}

    name = person_data.get("name")
    if not name:
        raise ValidationError("Person name is required")

    # Determine person_type from role if not explicitly provided
    role = person_data.get("role", "")
    person_type = person_data.get("person_type")
    if not person_type:
        person_type = _infer_person_type(role)

    # Prepare contact info
    phones = person_data.get("phones", [])
    emails = person_data.get("emails", [])

    # Handle simple string phone/email (convenience)
    if person_data.get("phone") and not phones:
        phones = [{"value": person_data["phone"], "primary": True}]
    if person_data.get("email") and not emails:
        emails = [{"value": person_data["email"], "primary": True}]

    # Create the person
    cur.execute("""
        INSERT INTO persons (
            person_type, name, phones, emails, address,
            organization, attributes, notes
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (
        person_type,
        name,
        json.dumps(phones),
        json.dumps(emails),
        person_data.get("address"),
        person_data.get("organization"),
        json.dumps(person_data.get("attributes", {})),
        person_data.get("notes")
    ))
    person_id = cur.fetchone()["id"]
    result["person_id"] = person_id

    # Assign to case if role is provided (and not a judge role - judges go on proceedings)
    if role and role not in ["Judge", "Magistrate Judge"]:
        side = person_data.get("side")
        if side:
            validate_person_side(side)
        else:
            # Infer side from role
            side = _infer_side(role)

        cur.execute("""
            INSERT INTO case_persons (
                case_id, person_id, role, side, case_attributes,
                case_notes, is_primary, assigned_date
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (case_id, person_id, role) DO UPDATE SET
                side = EXCLUDED.side,
                case_attributes = EXCLUDED.case_attributes,
                case_notes = EXCLUDED.case_notes,
                is_primary = EXCLUDED.is_primary
            RETURNING id
        """, (
            case_id,
            person_id,
            role,
            side,
            json.dumps(person_data.get("case_attributes", {})),
            person_data.get("case_notes"),
            person_data.get("is_primary", False),
            person_data.get("assigned_date")
        ))
        result["case_person_id"] = cur.fetchone()["id"]

    return result


def _infer_person_type(role: str) -> str:
    """Infer person_type from role."""
    role_lower = role.lower() if role else ""

    mapping = {
        "client": "client",
        "plaintiff": "client",
        "defendant": "defendant",
        "opposing counsel": "attorney",
        "defense counsel": "attorney",
        "co-counsel": "attorney",
        "attorney": "attorney",
        "counsel": "attorney",
        "judge": "judge",
        "magistrate": "judge",
        "expert": "expert",
        "plaintiff expert": "expert",
        "defense expert": "expert",
        "mediator": "mediator",
        "arbitrator": "mediator",
        "witness": "witness",
        "lien holder": "lien_holder",
        "lienholder": "lien_holder",
        "interpreter": "interpreter",
        "court reporter": "court_reporter",
        "process server": "process_server",
        "investigator": "investigator",
        "insurance adjuster": "insurance_adjuster",
        "adjuster": "insurance_adjuster",
        "guardian": "guardian",
    }

    for key, value in mapping.items():
        if key in role_lower:
            return value

    return "attorney"  # Default fallback


def _infer_side(role: str) -> str:
    """Infer side from role."""
    role_lower = role.lower() if role else ""

    plaintiff_keywords = ["client", "plaintiff", "co-counsel", "plaintiff expert"]
    defendant_keywords = ["defendant", "defense", "opposing"]
    neutral_keywords = ["judge", "mediator", "arbitrator", "court reporter", "interpreter"]

    for keyword in plaintiff_keywords:
        if keyword in role_lower:
            return "plaintiff"
    for keyword in defendant_keywords:
        if keyword in role_lower:
            return "defendant"
    for keyword in neutral_keywords:
        if keyword in role_lower:
            return "neutral"

    return "neutral"  # Default fallback


def _create_proceeding(cur, case_id: int, proc_data: dict, person_name_map: dict) -> dict:
    """Create a proceeding with jurisdiction and judges."""
    result = {
        "proceeding_id": None,
        "jurisdiction_created": None,
        "judges": []
    }

    case_number = proc_data.get("case_number")
    if not case_number:
        raise ValidationError("Proceeding case_number is required")

    # Handle jurisdiction - look up by name or create new
    jurisdiction_id = proc_data.get("jurisdiction_id")
    jurisdiction_name = proc_data.get("jurisdiction")

    if jurisdiction_name and not jurisdiction_id:
        # Try to find existing
        cur.execute(
            "SELECT id FROM jurisdictions WHERE LOWER(name) = LOWER(%s)",
            (jurisdiction_name,)
        )
        row = cur.fetchone()
        if row:
            jurisdiction_id = row["id"]
        else:
            # Create new jurisdiction
            cur.execute(
                "INSERT INTO jurisdictions (name) VALUES (%s) RETURNING id, name",
                (jurisdiction_name,)
            )
            new_jur = cur.fetchone()
            jurisdiction_id = new_jur["id"]
            result["jurisdiction_created"] = {"id": new_jur["id"], "name": new_jur["name"]}

    # Create the proceeding
    cur.execute("""
        INSERT INTO proceedings (
            case_id, case_number, jurisdiction_id, is_primary, notes
        )
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id
    """, (
        case_id,
        case_number,
        jurisdiction_id,
        proc_data.get("is_primary", False),
        proc_data.get("notes")
    ))
    proceeding_id = cur.fetchone()["id"]
    result["proceeding_id"] = proceeding_id

    # Handle judges - can be specified as judge_name, judge_names, or judges array
    judge_names = []
    if proc_data.get("judge_name"):
        judge_names.append(proc_data["judge_name"])
    if proc_data.get("judge_names"):
        judge_names.extend(proc_data["judge_names"])
    if proc_data.get("judges"):
        for j in proc_data["judges"]:
            if isinstance(j, str):
                judge_names.append(j)
            elif isinstance(j, dict) and j.get("name"):
                judge_names.append(j["name"])

    # Link judges to proceeding
    for idx, judge_name in enumerate(judge_names):
        judge_name_lower = judge_name.lower().strip()
        person_id = person_name_map.get(judge_name_lower)

        if not person_id:
            # Judge wasn't in persons list, create them
            cur.execute("""
                INSERT INTO persons (person_type, name, phones, emails, attributes)
                VALUES ('judge', %s, '[]', '[]', '{}')
                RETURNING id
            """, (judge_name,))
            person_id = cur.fetchone()["id"]
            person_name_map[judge_name_lower] = person_id

        # Determine judge role
        judge_role = "Judge"
        if "magistrate" in judge_name_lower:
            judge_role = "Magistrate Judge"

        # Add to proceeding
        cur.execute("""
            INSERT INTO judges (proceeding_id, person_id, role, sort_order)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (proceeding_id, person_id) DO NOTHING
            RETURNING id
        """, (proceeding_id, person_id, judge_role, idx))

        row = cur.fetchone()
        if row:
            result["judges"].append({
                "id": row["id"],
                "person_id": person_id,
                "name": judge_name,
                "role": judge_role
            })

    return result


def _create_event(cur, case_id: int, event_data: dict) -> int:
    """Create an event."""
    date = event_data.get("date")
    if not date:
        raise ValidationError("Event date is required")
    validate_date_format(date, "date")

    description = event_data.get("description")
    if not description:
        raise ValidationError("Event description is required")

    time = event_data.get("time")
    if time:
        validate_time_format(time, "time")

    cur.execute("""
        INSERT INTO events (
            case_id, date, time, description, location,
            document_link, calculation_note, starred
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (
        case_id,
        date,
        time,
        description,
        event_data.get("location"),
        event_data.get("document_link"),
        event_data.get("calculation_note"),
        event_data.get("starred", False)
    ))
    return cur.fetchone()["id"]


def _create_task(cur, case_id: int, task_data: dict) -> int:
    """Create a task."""
    description = task_data.get("description")
    if not description:
        raise ValidationError("Task description is required")

    status = task_data.get("status", "Pending")
    if status not in TASK_STATUSES:
        raise ValidationError(f"Invalid task status '{status}'")

    urgency = task_data.get("urgency", 2)
    if not isinstance(urgency, int) or urgency < 1 or urgency > 4:
        raise ValidationError(f"Invalid urgency '{urgency}'. Must be 1-4.")

    due_date = task_data.get("due_date")
    if due_date:
        validate_date_format(due_date, "due_date")

    # Get next sort_order for this case
    cur.execute(
        "SELECT COALESCE(MAX(sort_order), 0) + 1000 as next_order FROM tasks WHERE case_id = %s",
        (case_id,)
    )
    sort_order = cur.fetchone()["next_order"]

    cur.execute("""
        INSERT INTO tasks (
            case_id, description, due_date, status, urgency, sort_order
        )
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (
        case_id,
        description,
        due_date,
        status,
        urgency,
        sort_order
    ))
    return cur.fetchone()["id"]


def _create_note(cur, case_id: int, note_data: dict) -> int:
    """Create a note."""
    content = note_data.get("content")
    if not content:
        raise ValidationError("Note content is required")

    cur.execute("""
        INSERT INTO notes (case_id, content)
        VALUES (%s, %s)
        RETURNING id
    """, (case_id, content))
    return cur.fetchone()["id"]


def _create_activity(cur, case_id: int, activity_data: dict) -> int:
    """Create an activity."""
    description = activity_data.get("description")
    if not description:
        raise ValidationError("Activity description is required")

    activity_type = activity_data.get("type", "Other")
    date = activity_data.get("date")
    if date:
        validate_date_format(date, "date")
    else:
        # Default to today
        from datetime import date as dt_date
        date = dt_date.today().isoformat()

    cur.execute("""
        INSERT INTO activities (case_id, date, description, type, minutes)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id
    """, (
        case_id,
        date,
        description,
        activity_type,
        activity_data.get("minutes")
    ))
    return cur.fetchone()["id"]
