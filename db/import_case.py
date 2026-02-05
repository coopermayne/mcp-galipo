"""
Bulk case import - creates a case with all related entities in a single transaction.

Optimized for Claude AI to parse unstructured case summaries into structured JSON,
then import everything at once.

Uses the unified roles schema: persons + person_roles + roles.
Judges are standalone entities linked to proceedings via proceeding_judges.
"""

import json
from typing import Optional
from .connection import get_connection, serialize_row
from .validation import (
    validate_case_status,
    validate_date_format,
    validate_time_format,
    ValidationError,
    CASE_STATUSES,
)
from psycopg2.extras import RealDictCursor


def import_case(data: dict) -> dict:
    """
    Import a complete case with all related entities in a single transaction.

    Args:
        data: Dictionary with structure:
            {
                "case": { case fields },
                "persons": [ { person + role_name for case assignment } ],
                "proceedings": [ { case_number, jurisdiction, judges[] } ],
                "events": [ { event fields - hearings, deadlines, depositions, etc. } ],
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
            "person_roles": [],
            "proceedings": [],
            "judges": [],
            "events": [],
            "notes": [],
            "activities": [],
            "jurisdictions": [],
        },
        "assigned_attorneys": [],
        "assigned_paralegals": [],
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
            persons_data = data.get("persons", [])
            for person_data in persons_data:
                person_result = _create_person_and_assign(cur, case_id, person_data)
                result["created"]["persons"].append({
                    "id": person_result["person_id"],
                    "name": person_data.get("name")
                })
                if person_result.get("person_role_id"):
                    result["created"]["person_roles"].append({
                        "id": person_result["person_role_id"],
                        "person_id": person_result["person_id"],
                        "role_name": person_result.get("role_name")
                    })

            # 3. Create proceedings with judges
            proceedings_data = data.get("proceedings", [])
            for proc_data in proceedings_data:
                proc_result = _create_proceeding(cur, case_id, proc_data)
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

            # 4. Create events (hearings, deadlines, depositions, etc.)
            events_data = data.get("events", [])
            for event_data in events_data:
                event_id = _create_event(cur, case_id, event_data)
                result["created"]["events"].append({
                    "id": event_id,
                    "description": event_data.get("description")
                })

            # 5. Create notes
            notes_data = data.get("notes", [])
            for note_data in notes_data:
                note_id = _create_note(cur, case_id, note_data)
                result["created"]["notes"].append({"id": note_id})

            # 6. Create activities
            activities_data = data.get("activities", [])
            for activity_data in activities_data:
                activity_id = _create_activity(cur, case_id, activity_data)
                result["created"]["activities"].append({
                    "id": activity_id,
                    "description": activity_data.get("description")
                })

            # 7. Assign attorneys (and auto-assign their paralegals)
            attorney_ids = data.get("attorney_ids", [])
            if attorney_ids:
                assigned = _assign_attorneys(cur, case_id, attorney_ids)
                result["assigned_attorneys"] = assigned["attorneys"]
                result["assigned_paralegals"] = assigned["paralegals"]

            # Build summary
            result["summary"] = {
                "case_name": case_data.get("case_name"),
                "persons_created": len(result["created"]["persons"]),
                "proceedings_created": len(result["created"]["proceedings"]),
                "judges_assigned": len(result["created"]["judges"]),
                "events_created": len(result["created"]["events"]),
                "notes_created": len(result["created"]["notes"]),
                "activities_created": len(result["created"]["activities"]),
                "attorneys_assigned": len(result["assigned_attorneys"]),
                "paralegals_auto_assigned": len(result["assigned_paralegals"]),
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
    """Create a person and optionally assign to the case with a role."""
    result = {"person_id": None, "person_role_id": None, "role_name": None}

    name = person_data.get("name")
    if not name:
        raise ValidationError("Person name is required")

    # Get the role by name (required for assignment)
    role_name = person_data.get("role") or person_data.get("role_name")
    role_id = None
    if role_name:
        role_id = _get_or_create_role_id(cur, role_name)
        result["role_name"] = role_name

    # Prepare contact info
    phones = person_data.get("phones", [])
    emails = person_data.get("emails", [])

    # Handle simple string phone/email (convenience)
    if person_data.get("phone") and not phones:
        phones = [{"value": person_data["phone"], "primary": True}]
    if person_data.get("email") and not emails:
        emails = [{"value": person_data["email"], "primary": True}]

    # Create the person (no person_type in new schema)
    cur.execute("""
        INSERT INTO persons (name, phones, emails, address, organization, notes)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (
        name,
        json.dumps(phones),
        json.dumps(emails),
        person_data.get("address"),
        person_data.get("organization"),
        person_data.get("notes")
    ))
    person_id = cur.fetchone()["id"]
    result["person_id"] = person_id

    # Assign to case if role is provided
    if role_id:
        cur.execute("""
            INSERT INTO person_roles (person_id, role_id, case_id, attributes, notes,
                                      is_primary, assigned_date)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT ON CONSTRAINT uq_person_roles_case DO UPDATE SET
                attributes = EXCLUDED.attributes,
                notes = EXCLUDED.notes,
                is_primary = EXCLUDED.is_primary
            RETURNING id
        """, (
            person_id,
            role_id,
            case_id,
            json.dumps(person_data.get("attributes", {})),
            person_data.get("role_notes"),
            person_data.get("is_primary", False),
            person_data.get("assigned_date")
        ))
        result["person_role_id"] = cur.fetchone()["id"]

    return result


def _get_or_create_role_id(cur, role_name: str) -> int:
    """Get role ID by name, inferring category if we need to create it."""
    # Try to find existing role
    cur.execute("SELECT id FROM roles WHERE LOWER(name) = LOWER(%s)", (role_name,))
    row = cur.fetchone()
    if row:
        return row["id"]

    # Infer category from role name
    category = _infer_role_category(role_name)

    # Create the role
    cur.execute("""
        INSERT INTO roles (name, category, sort_order)
        VALUES (%s, %s, 99)
        RETURNING id
    """, (role_name, category))
    return cur.fetchone()["id"]


def _infer_role_category(role_name: str) -> str:
    """Infer role category from role name."""
    role_lower = role_name.lower() if role_name else ""

    # Client category
    if any(k in role_lower for k in ["client", "plaintiff"]):
        return "client"

    # Internal team
    if any(k in role_lower for k in ["lead attorney", "associate attorney", "paralegal",
                                      "case manager", "legal assistant"]):
        return "internal_team"

    # Opposing team
    if any(k in role_lower for k in ["defense counsel", "opposing counsel", "defendant",
                                      "defense expert"]):
        return "opposing_team"

    # Default to third_party
    return "third_party"


def _create_proceeding(cur, case_id: int, proc_data: dict) -> dict:
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

    # Handle judges - can be specified as:
    #   "judge_name": "Hon. Smith"              (single judge, role auto-detected)
    #   "judges": ["Hon. Smith", "Mag. Jones"]  (array of names)
    #   "judges": [                             (array of objects with explicit roles)
    #       {"name": "Hon. Smith", "role": "Presiding"},
    #       {"name": "Hon. Jones", "role": "Panel"},
    #       {"name": "Mag. Wilson", "role": "Magistrate Judge"}
    #   ]
    judge_entries = []  # list of {"name": str, "role": str|None}
    if proc_data.get("judge_name"):
        judge_entries.append({"name": proc_data["judge_name"], "role": None})
    if proc_data.get("judges"):
        for j in proc_data["judges"]:
            if isinstance(j, str):
                judge_entries.append({"name": j, "role": None})
            elif isinstance(j, dict) and j.get("name"):
                judge_entries.append({"name": j["name"], "role": j.get("role")})

    # Link judges to proceeding - judges are now standalone entities
    for idx, entry in enumerate(judge_entries):
        judge_name = entry["name"]
        judge_name_lower = judge_name.lower().strip()

        # Check if judge already exists
        cur.execute("SELECT id FROM judges WHERE LOWER(name) = LOWER(%s)", (judge_name,))
        judge_row = cur.fetchone()

        if judge_row:
            judge_id = judge_row["id"]
        else:
            # Create new judge
            cur.execute("""
                INSERT INTO judges (name, phones, emails, jurisdiction_id)
                VALUES (%s, '[]', '[]', %s)
                RETURNING id
            """, (judge_name, jurisdiction_id))
            judge_id = cur.fetchone()["id"]

        # Determine judge role: explicit > auto-detect from name
        judge_role = entry["role"]
        if not judge_role:
            if "magistrate" in judge_name_lower:
                judge_role = "Magistrate Judge"
            else:
                judge_role = "Judge"

        # Add to proceeding via proceeding_judges
        cur.execute("""
            INSERT INTO proceeding_judges (proceeding_id, judge_id, role, sort_order)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (proceeding_id, judge_id) DO NOTHING
            RETURNING id
        """, (proceeding_id, judge_id, judge_role, idx))

        row = cur.fetchone()
        if row:
            result["judges"].append({
                "id": row["id"],
                "judge_id": judge_id,
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


def _assign_attorneys(cur, case_id: int, attorney_ids: list) -> dict:
    """Assign attorneys to case and auto-assign their default paralegals.

    Uses the same cursor as the import transaction so everything is atomic.
    """
    assigned_attorneys = []
    assigned_paralegals = []
    paralegal_ids = []

    for user_id in attorney_ids:
        # Verify the user exists and is an active attorney
        cur.execute("""
            SELECT id, first_name, last_name, initials, paralegal_id
            FROM users
            WHERE id = %s AND is_active = TRUE AND position = 'attorney'
        """, (user_id,))
        row = cur.fetchone()
        if not row:
            raise ValidationError(
                f"Attorney with id={user_id} not found or is not an active attorney. "
                "Use list_attorneys() to see available attorneys."
            )

        assigned_attorneys.append({
            "id": row["id"],
            "name": f"{row['first_name']} {row['last_name']}",
            "initials": row["initials"],
        })

        # Collect their default paralegal
        if row["paralegal_id"] and row["paralegal_id"] not in paralegal_ids:
            paralegal_ids.append(row["paralegal_id"])

    # Fetch paralegal details for the response
    for p_id in paralegal_ids:
        cur.execute("""
            SELECT id, first_name, last_name, initials
            FROM users WHERE id = %s AND is_active = TRUE
        """, (p_id,))
        p_row = cur.fetchone()
        if p_row:
            assigned_paralegals.append({
                "id": p_row["id"],
                "name": f"{p_row['first_name']} {p_row['last_name']}",
                "initials": p_row["initials"],
                "auto_assigned": True,
            })

    # Write attorney_ids and paralegal_ids to the case
    cur.execute("""
        UPDATE cases
        SET attorney_ids = %s, paralegal_ids = %s, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
    """, (attorney_ids, paralegal_ids, case_id))

    return {"attorneys": assigned_attorneys, "paralegals": assigned_paralegals}
