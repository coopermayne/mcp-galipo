"""
Bulk case import - creates a case with all related entities in a single transaction.

Optimized for Claude AI to parse unstructured case summaries into structured JSON,
then import everything at once.

Uses the unified roles schema: persons + person_roles + roles.
Judges are standalone entities linked to proceedings via proceeding_judges.
"""

import datetime
from typing import Optional

from sqlalchemy import select, func

from .session import SessionLocal
from .validation import (
    validate_case_status,
    validate_date_format,
    validate_time_format,
    ValidationError,
    CASE_STATUSES,
)
from models import (
    Case, Person, Role, PersonRole, Jurisdiction, Proceeding,
    ProceedingJudge, Judge, Event, Note, Activity, User,
)


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

    # Use a single session for the entire transaction
    with SessionLocal() as session:
        try:
            # 1. Create the case
            case_id = _create_case(session, case_data)
            result["case_id"] = case_id

            # 2. Create persons and assign to case
            persons_data = data.get("persons", [])
            for person_data in persons_data:
                person_result = _create_person_and_assign(session, case_id, person_data)
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
                proc_result = _create_proceeding(session, case_id, proc_data)
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
                event_id = _create_event(session, case_id, event_data)
                result["created"]["events"].append({
                    "id": event_id,
                    "description": event_data.get("description")
                })

            # 5. Create notes
            notes_data = data.get("notes", [])
            for note_data in notes_data:
                note_id = _create_note(session, case_id, note_data)
                result["created"]["notes"].append({"id": note_id})

            # 6. Create activities
            activities_data = data.get("activities", [])
            for activity_data in activities_data:
                activity_id = _create_activity(session, case_id, activity_data)
                result["created"]["activities"].append({
                    "id": activity_id,
                    "description": activity_data.get("description")
                })

            # 7. Assign attorneys (and auto-assign their paralegals)
            attorney_ids = data.get("attorney_ids", [])
            if attorney_ids:
                assigned = _assign_attorneys(session, case_id, attorney_ids)
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

            session.commit()

        except ValidationError:
            session.rollback()
            raise
        except Exception as e:
            session.rollback()
            raise ValidationError(f"Import failed: {str(e)}")

    return result


def _create_case(session, case_data: dict) -> int:
    """Create a case and return its ID."""
    # Assign a color if not provided
    colors = ["blue", "emerald", "amber", "red", "violet", "pink", "cyan", "orange", "indigo", "teal"]

    # Get next color based on case count
    count = session.scalar(select(func.count()).select_from(Case)) or 0
    color = case_data.get("color") or colors[count % len(colors)]

    case = Case(
        case_name=case_data.get("case_name"),
        short_name=case_data.get("short_name"),
        status=case_data.get("status", "Signing Up"),
        print_code=case_data.get("print_code"),
        case_summary=case_data.get("case_summary"),
        result=case_data.get("result"),
        date_of_injury=case_data.get("date_of_injury"),
        color=color,
    )
    session.add(case)
    session.flush()
    return case.id


def _create_person_and_assign(session, case_id: int, person_data: dict) -> dict:
    """Create a person and optionally assign to the case with a role."""
    result = {"person_id": None, "person_role_id": None, "role_name": None}

    name = person_data.get("name")
    if not name:
        raise ValidationError("Person name is required")

    # Get the role by name (required for assignment)
    role_name = person_data.get("role") or person_data.get("role_name")
    role_id = None
    if role_name:
        role_id = _get_or_create_role_id(session, role_name)
        result["role_name"] = role_name

    # Prepare contact info
    phones = person_data.get("phones", [])
    emails = person_data.get("emails", [])

    # Handle simple string phone/email (convenience)
    if person_data.get("phone") and not phones:
        phones = [{"value": person_data["phone"], "primary": True}]
    if person_data.get("email") and not emails:
        emails = [{"value": person_data["email"], "primary": True}]

    # Create the person
    person = Person(
        name=name,
        phones=phones,
        emails=emails,
        address=person_data.get("address"),
        organization=person_data.get("organization"),
        notes=person_data.get("notes"),
    )
    session.add(person)
    session.flush()
    person_id = person.id
    result["person_id"] = person_id

    # Assign to case if role is provided
    if role_id:
        attrs = person_data.get("attributes", {})
        role_notes = person_data.get("role_notes")
        is_primary = person_data.get("is_primary", False)
        assigned_date = person_data.get("assigned_date")

        # Check if assignment already exists
        existing = session.scalar(
            select(PersonRole.id).where(
                PersonRole.person_id == person_id,
                PersonRole.role_id == role_id,
                PersonRole.case_id == case_id,
            )
        )

        if existing:
            pr = session.get(PersonRole, existing)
            pr.attributes = attrs
            pr.notes = role_notes
            pr.is_primary = is_primary
            session.flush()
            result["person_role_id"] = pr.id
        else:
            pr = PersonRole(
                person_id=person_id,
                role_id=role_id,
                case_id=case_id,
                attributes=attrs,
                notes=role_notes,
                is_primary=is_primary,
                assigned_date=assigned_date,
            )
            session.add(pr)
            session.flush()
            result["person_role_id"] = pr.id

    return result


def _get_or_create_role_id(session, role_name: str) -> int:
    """Get role ID by name, inferring category if we need to create it."""
    # Try to find existing role (case-insensitive)
    role = session.scalar(
        select(Role).where(func.lower(Role.name) == func.lower(role_name))
    )
    if role:
        return role.id

    # Infer category from role name
    category = _infer_role_category(role_name)

    # Create the role
    new_role = Role(name=role_name, category=category, sort_order=99)
    session.add(new_role)
    session.flush()
    return new_role.id


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


def _create_proceeding(session, case_id: int, proc_data: dict) -> dict:
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
        jur = session.scalar(
            select(Jurisdiction).where(
                func.lower(Jurisdiction.name) == func.lower(jurisdiction_name)
            )
        )
        if jur:
            jurisdiction_id = jur.id
        else:
            # Create new jurisdiction
            new_jur = Jurisdiction(name=jurisdiction_name)
            session.add(new_jur)
            session.flush()
            jurisdiction_id = new_jur.id
            result["jurisdiction_created"] = {"id": new_jur.id, "name": new_jur.name}

    # Create the proceeding
    proceeding = Proceeding(
        case_id=case_id,
        case_number=case_number,
        jurisdiction_id=jurisdiction_id,
        is_primary=proc_data.get("is_primary", False),
        notes=proc_data.get("notes"),
    )
    session.add(proceeding)
    session.flush()
    proceeding_id = proceeding.id
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

    # Link judges to proceeding - judges are standalone entities
    for idx, entry in enumerate(judge_entries):
        judge_name = entry["name"]
        judge_name_lower = judge_name.lower().strip()

        # Check if judge already exists
        judge = session.scalar(
            select(Judge).where(func.lower(Judge.name) == func.lower(judge_name))
        )

        if not judge:
            # Create new judge
            judge = Judge(
                name=judge_name,
                phones=[],
                emails=[],
                jurisdiction_id=jurisdiction_id,
            )
            session.add(judge)
            session.flush()

        # Determine judge role: explicit > auto-detect from name
        judge_role = entry["role"]
        if not judge_role:
            if "magistrate" in judge_name_lower:
                judge_role = "Magistrate Judge"
            else:
                judge_role = "Judge"

        # Add to proceeding via proceeding_judges
        # Check if already linked (ON CONFLICT DO NOTHING equivalent)
        existing_pj = session.scalar(
            select(ProceedingJudge).where(
                ProceedingJudge.proceeding_id == proceeding_id,
                ProceedingJudge.judge_id == judge.id,
            )
        )
        if not existing_pj:
            pj = ProceedingJudge(
                proceeding_id=proceeding_id,
                judge_id=judge.id,
                role=judge_role,
                sort_order=idx,
            )
            session.add(pj)
            session.flush()

            result["judges"].append({
                "id": pj.id,
                "judge_id": judge.id,
                "name": judge_name,
                "role": judge_role
            })

    return result


def _create_event(session, case_id: int, event_data: dict) -> int:
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

    event = Event(
        case_id=case_id,
        date=date,
        time=time,
        description=description,
        location=event_data.get("location"),
        document_link=event_data.get("document_link"),
        calculation_note=event_data.get("calculation_note"),
        starred=event_data.get("starred", False),
    )
    session.add(event)
    session.flush()
    return event.id


def _create_note(session, case_id: int, note_data: dict) -> int:
    """Create a note."""
    content = note_data.get("content")
    if not content:
        raise ValidationError("Note content is required")

    note = Note(case_id=case_id, content=content)
    session.add(note)
    session.flush()
    return note.id


def _create_activity(session, case_id: int, activity_data: dict) -> int:
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
        date = datetime.date.today().isoformat()

    activity = Activity(
        case_id=case_id,
        date=date,
        description=description,
        type=activity_type,
        minutes=activity_data.get("minutes"),
    )
    session.add(activity)
    session.flush()
    return activity.id


def _assign_attorneys(session, case_id: int, attorney_ids: list) -> dict:
    """Assign attorneys to case and auto-assign their default paralegals.

    Uses the same session as the import transaction so everything is atomic.
    """
    assigned_attorneys = []
    assigned_paralegals = []
    paralegal_ids = []

    for user_id in attorney_ids:
        # Verify the user exists and is an active attorney
        user = session.scalar(
            select(User).where(
                User.id == user_id,
                User.is_active == True,
                User.position == "attorney",
            )
        )
        if not user:
            raise ValidationError(
                f"Attorney with id={user_id} not found or is not an active attorney. "
                "Use list_attorneys() to see available attorneys."
            )

        assigned_attorneys.append({
            "id": user.id,
            "name": f"{user.first_name} {user.last_name}",
            "initials": user.initials,
        })

        # Collect their default paralegal
        if user.paralegal_id and user.paralegal_id not in paralegal_ids:
            paralegal_ids.append(user.paralegal_id)

    # Fetch paralegal details for the response
    for p_id in paralegal_ids:
        paralegal = session.scalar(
            select(User).where(User.id == p_id, User.is_active == True)
        )
        if paralegal:
            assigned_paralegals.append({
                "id": paralegal.id,
                "name": f"{paralegal.first_name} {paralegal.last_name}",
                "initials": paralegal.initials,
                "auto_assigned": True,
            })

    # Write attorney_ids and paralegal_ids to the case
    case = session.get(Case, case_id)
    case.attorney_ids = attorney_ids
    case.paralegal_ids = paralegal_ids
    session.flush()

    return {"attorneys": assigned_attorneys, "paralegals": assigned_paralegals}
