"""
Person/contact management functions.
"""

import json
from typing import Optional, List

from .connection import get_cursor, serialize_row, serialize_rows
from .validation import (
    validate_person_type, validate_person_side, validate_date_format
)


def create_person(person_type: str, name: str, phones: List[dict] = None,
                  emails: List[dict] = None, address: str = None,
                  organization: str = None, attributes: dict = None,
                  notes: str = None) -> dict:
    """Create a new person."""
    validate_person_type(person_type)
    phones_json = json.dumps(phones) if phones else '[]'
    emails_json = json.dumps(emails) if emails else '[]'
    attributes_json = json.dumps(attributes) if attributes else '{}'

    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO persons (person_type, name, phones, emails, address, organization, attributes, notes)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, person_type, name, phones, emails, address, organization, attributes, notes, created_at, updated_at, archived
        """, (person_type, name, phones_json, emails_json, address, organization, attributes_json, notes))
        return serialize_row(dict(cur.fetchone()))


def get_person_by_id(person_id: int) -> Optional[dict]:
    """Get person by ID with their case assignments."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT id, person_type, name, phones, emails, address, organization,
                   attributes, notes, created_at, updated_at, archived
            FROM persons WHERE id = %s
        """, (person_id,))
        person = cur.fetchone()
        if not person:
            return None

        result = serialize_row(dict(person))

        # Get case assignments
        cur.execute("""
            SELECT cp.id as assignment_id, cp.case_id, c.case_name, c.short_name,
                   cp.role, cp.side, cp.case_attributes, cp.case_notes,
                   cp.is_primary, cp.contact_via_person_id,
                   via.name as contact_via_name, cp.assigned_date, cp.created_at
            FROM case_persons cp
            JOIN cases c ON cp.case_id = c.id
            LEFT JOIN persons via ON cp.contact_via_person_id = via.id
            WHERE cp.person_id = %s
            ORDER BY c.case_name
        """, (person_id,))
        result["case_assignments"] = serialize_rows([dict(row) for row in cur.fetchall()])

        return result


def update_person(person_id: int, **kwargs) -> Optional[dict]:
    """Update person fields."""
    allowed_fields = ["name", "person_type", "phones", "emails", "address",
                      "organization", "attributes", "notes", "archived"]
    updates = []
    params = []

    for field, value in kwargs.items():
        if field not in allowed_fields:
            continue
        if value is None:
            continue

        if field == "person_type":
            validate_person_type(value)
        elif field in ["phones", "emails", "attributes"]:
            value = json.dumps(value) if isinstance(value, (list, dict)) else value

        updates.append(f"{field} = %s")
        params.append(value)

    if not updates:
        return get_person_by_id(person_id)

    updates.append("updated_at = CURRENT_TIMESTAMP")
    params.append(person_id)

    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE persons SET {', '.join(updates)}
            WHERE id = %s
            RETURNING id
        """, params)
        row = cur.fetchone()
        if not row:
            return None

    return get_person_by_id(person_id)


def search_persons(name: str = None, person_type: str = None, organization: str = None,
                   email: str = None, phone: str = None, case_id: int = None,
                   archived: bool = False, limit: int = 50, offset: int = 0) -> dict:
    """Search persons by various criteria."""
    conditions = ["p.archived = %s"]
    params = [archived]

    if name:
        conditions.append("p.name ILIKE %s")
        params.append(f"%{name}%")

    if person_type:
        validate_person_type(person_type)
        conditions.append("p.person_type = %s")
        params.append(person_type)

    if organization:
        conditions.append("p.organization ILIKE %s")
        params.append(f"%{organization}%")

    if email:
        conditions.append("p.emails::text ILIKE %s")
        params.append(f"%{email}%")

    if phone:
        conditions.append("p.phones::text ILIKE %s")
        params.append(f"%{phone}%")

    if case_id:
        conditions.append("EXISTS (SELECT 1 FROM case_persons cp WHERE cp.person_id = p.id AND cp.case_id = %s)")
        params.append(case_id)

    where_clause = f"WHERE {' AND '.join(conditions)}"

    with get_cursor() as cur:
        cur.execute(f"SELECT COUNT(*) as total FROM persons p {where_clause}", params)
        total = cur.fetchone()["total"]

        cur.execute(f"""
            SELECT p.id, p.person_type, p.name, p.phones, p.emails, p.organization,
                   p.attributes, p.notes, p.archived
            FROM persons p
            {where_clause}
            ORDER BY p.name
            LIMIT %s OFFSET %s
        """, params + [limit, offset])

        return {"persons": [dict(row) for row in cur.fetchall()], "total": total}


def archive_person(person_id: int) -> Optional[dict]:
    """Archive a person (soft delete)."""
    return update_person(person_id, archived=True)


def delete_person(person_id: int) -> bool:
    """Permanently delete a person."""
    with get_cursor() as cur:
        cur.execute("DELETE FROM persons WHERE id = %s", (person_id,))
        return cur.rowcount > 0


# ===== CASE-PERSON OPERATIONS =====

def assign_person_to_case(case_id: int, person_id: int, role: str, side: str = None,
                          case_attributes: dict = None, case_notes: str = None,
                          is_primary: bool = False, contact_via_person_id: int = None,
                          assigned_date: str = None) -> dict:
    """Assign a person to a case with a specific role."""
    if side:
        validate_person_side(side)
    validate_date_format(assigned_date, "assigned_date")

    case_attrs_json = json.dumps(case_attributes) if case_attributes else '{}'

    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO case_persons (case_id, person_id, role, side, case_attributes,
                                      case_notes, is_primary, contact_via_person_id, assigned_date)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (case_id, person_id, role) DO UPDATE SET
                side = EXCLUDED.side,
                case_attributes = EXCLUDED.case_attributes,
                case_notes = EXCLUDED.case_notes,
                is_primary = EXCLUDED.is_primary,
                contact_via_person_id = EXCLUDED.contact_via_person_id,
                assigned_date = EXCLUDED.assigned_date
            RETURNING id
        """, (case_id, person_id, role, side, case_attrs_json, case_notes,
              is_primary, contact_via_person_id, assigned_date))
        assignment_id = cur.fetchone()["id"]

        # Return full assignment details
        cur.execute("""
            SELECT p.id, p.person_type, p.name, p.phones, p.emails, p.organization,
                   p.attributes, p.notes as person_notes,
                   cp.id as assignment_id, cp.role, cp.side, cp.case_attributes,
                   cp.case_notes, cp.is_primary, cp.contact_via_person_id,
                   cp.assigned_date, cp.created_at as assigned_at,
                   via.name as contact_via_name
            FROM persons p
            JOIN case_persons cp ON p.id = cp.person_id
            LEFT JOIN persons via ON cp.contact_via_person_id = via.id
            WHERE cp.id = %s
        """, (assignment_id,))
        return serialize_row(dict(cur.fetchone()))


def update_case_assignment(case_id: int, person_id: int, role: str, **kwargs) -> Optional[dict]:
    """Update a case-person assignment."""
    allowed_fields = ["side", "case_attributes", "case_notes", "is_primary",
                      "contact_via_person_id", "assigned_date"]
    updates = []
    params = []

    for field, value in kwargs.items():
        if field not in allowed_fields:
            continue

        if field == "side" and value:
            validate_person_side(value)
        elif field == "assigned_date" and value:
            validate_date_format(value, "assigned_date")
        elif field == "case_attributes":
            value = json.dumps(value) if isinstance(value, dict) else value

        updates.append(f"{field} = %s")
        params.append(value)

    if not updates:
        return None

    params.extend([case_id, person_id, role])

    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE case_persons SET {', '.join(updates)}
            WHERE case_id = %s AND person_id = %s AND role = %s
            RETURNING id
        """, params)
        row = cur.fetchone()
        if not row:
            return None

        assignment_id = row["id"]
        cur.execute("""
            SELECT p.id, p.person_type, p.name, p.phones, p.emails, p.organization,
                   p.attributes, p.notes as person_notes,
                   cp.id as assignment_id, cp.role, cp.side, cp.case_attributes,
                   cp.case_notes, cp.is_primary, cp.contact_via_person_id,
                   cp.assigned_date, cp.created_at as assigned_at,
                   via.name as contact_via_name
            FROM persons p
            JOIN case_persons cp ON p.id = cp.person_id
            LEFT JOIN persons via ON cp.contact_via_person_id = via.id
            WHERE cp.id = %s
        """, (assignment_id,))
        return serialize_row(dict(cur.fetchone()))


def remove_person_from_case(case_id: int, person_id: int, role: str = None) -> bool:
    """Remove a person from a case."""
    with get_cursor() as cur:
        if role:
            cur.execute("""
                DELETE FROM case_persons
                WHERE case_id = %s AND person_id = %s AND role = %s
            """, (case_id, person_id, role))
        else:
            cur.execute("""
                DELETE FROM case_persons
                WHERE case_id = %s AND person_id = %s
            """, (case_id, person_id))
        return cur.rowcount > 0


def get_case_persons(case_id: int, person_type: str = None, role: str = None,
                     side: str = None) -> List[dict]:
    """Get all persons assigned to a case with optional filters."""
    conditions = ["cp.case_id = %s"]
    params = [case_id]

    if person_type:
        validate_person_type(person_type)
        conditions.append("p.person_type = %s")
        params.append(person_type)

    if role:
        conditions.append("cp.role = %s")
        params.append(role)

    if side:
        validate_person_side(side)
        conditions.append("cp.side = %s")
        params.append(side)

    where_clause = " AND ".join(conditions)

    with get_cursor() as cur:
        cur.execute(f"""
            SELECT p.id, p.person_type, p.name, p.phones, p.emails, p.organization,
                   p.attributes, p.notes as person_notes,
                   cp.id as assignment_id, cp.role, cp.side, cp.case_attributes,
                   cp.case_notes, cp.is_primary, cp.contact_via_person_id,
                   cp.assigned_date, cp.created_at as assigned_at,
                   via.name as contact_via_name
            FROM persons p
            JOIN case_persons cp ON p.id = cp.person_id
            LEFT JOIN persons via ON cp.contact_via_person_id = via.id
            WHERE {where_clause}
            ORDER BY cp.role, p.name
        """, params)

        return [dict(row) for row in cur.fetchall()]
