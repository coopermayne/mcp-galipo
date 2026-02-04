"""
Person/contact management functions.
"""

import json
from typing import Optional, List

from .connection import get_cursor, serialize_row, serialize_rows
from .validation import (
    validate_person_type, validate_person_side, validate_date_format,
    validate_case_person_role
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
                   cp.is_primary, cp.grouped_under_id,
                   via.name as grouped_under_name, cp.assigned_date, cp.created_at
            FROM case_persons cp
            JOIN cases c ON cp.case_id = c.id
            LEFT JOIN persons via ON cp.grouped_under_id = via.id
            WHERE cp.person_id = %s
            ORDER BY c.case_name
        """, (person_id,))
        result["case_assignments"] = serialize_rows([dict(row) for row in cur.fetchall()])

        return result


def update_person(person_id: int, **kwargs) -> Optional[dict]:
    """Update person fields."""
    allowed_fields = ["name", "person_type", "phones", "emails", "address",
                      "organization", "attributes", "notes"]
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
                   unassigned: bool = False, include_cases: bool = False,
                   user_id: int = None,
                   limit: int = 50, offset: int = 0) -> dict:
    """Search persons by various criteria."""
    conditions = []
    params = []

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

    if unassigned:
        # Judges are linked via the judges table (to proceedings), not case_persons
        conditions.append("""(
            CASE WHEN p.person_type = 'judge'
                THEN NOT EXISTS (SELECT 1 FROM judges j WHERE j.person_id = p.id)
                ELSE NOT EXISTS (SELECT 1 FROM case_persons cp WHERE cp.person_id = p.id)
            END
        )""")

    if user_id:
        conditions.append("""EXISTS (
            SELECT 1 FROM case_persons cp2
            JOIN cases c ON cp2.case_id = c.id
            WHERE cp2.person_id = p.id
            AND (%s = ANY(c.attorney_ids) OR %s = ANY(c.paralegal_ids))
        )""")
        params.append(user_id)
        params.append(user_id)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with get_cursor() as cur:
        cur.execute(f"SELECT COUNT(*) as total FROM persons p {where_clause}", params)
        total = cur.fetchone()["total"]

        cur.execute(f"""
            SELECT p.id, p.person_type, p.name, p.phones, p.emails, p.organization,
                   p.attributes, p.notes, p.archived, p.created_at
            FROM persons p
            {where_clause}
            ORDER BY p.name
            LIMIT %s OFFSET %s
        """, params + [limit, offset])

        persons = serialize_rows([dict(row) for row in cur.fetchall()])

        if include_cases and persons:
            person_ids = [p["id"] for p in persons]
            cur.execute("""
                SELECT cp.person_id, cp.case_id, c.short_name, c.case_name, c.color
                FROM case_persons cp
                JOIN cases c ON cp.case_id = c.id
                WHERE cp.person_id = ANY(%s)
                ORDER BY c.case_name
            """, (person_ids,))
            # Build a map of person_id -> list of case assignments
            case_map: dict = {}
            for row in cur.fetchall():
                pid = row["person_id"]
                if pid not in case_map:
                    case_map[pid] = []
                case_map[pid].append({
                    "case_id": row["case_id"],
                    "short_name": row["short_name"],
                    "case_name": row["case_name"],
                    "color": row["color"],
                })
            for p in persons:
                p["case_assignments"] = case_map.get(p["id"], [])

        return {"persons": persons, "total": total}


def delete_person(person_id: int) -> bool:
    """Permanently delete a person. Clears grouped_under references first."""
    with get_cursor() as cur:
        cur.execute("UPDATE case_persons SET grouped_under_id = NULL WHERE grouped_under_id = %s", (person_id,))
        cur.execute("DELETE FROM persons WHERE id = %s", (person_id,))
        return cur.rowcount > 0


# ===== CASE-PERSON OPERATIONS =====

def assign_person_to_case(case_id: int, person_id: int, role: str, side: str = None,
                          case_attributes: dict = None, case_notes: str = None,
                          is_primary: bool = False, grouped_under_id: int = None,
                          assigned_date: str = None) -> dict:
    """Assign a person to a case with a specific role."""
    validate_case_person_role(role)
    if side:
        validate_person_side(side)
    validate_date_format(assigned_date, "assigned_date")

    case_attrs_json = json.dumps(case_attributes) if case_attributes else '{}'

    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO case_persons (case_id, person_id, role, side, case_attributes,
                                      case_notes, is_primary, grouped_under_id, assigned_date)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (case_id, person_id, role) DO UPDATE SET
                side = EXCLUDED.side,
                case_attributes = EXCLUDED.case_attributes,
                case_notes = EXCLUDED.case_notes,
                is_primary = EXCLUDED.is_primary,
                grouped_under_id = EXCLUDED.grouped_under_id,
                assigned_date = EXCLUDED.assigned_date
            RETURNING id
        """, (case_id, person_id, role, side, case_attrs_json, case_notes,
              is_primary, grouped_under_id, assigned_date))
        assignment_id = cur.fetchone()["id"]

        # Return full assignment details
        cur.execute("""
            SELECT p.id, p.person_type, p.name, p.phones, p.emails, p.organization,
                   p.attributes, p.notes as person_notes,
                   cp.id as assignment_id, cp.role, cp.side, cp.case_attributes,
                   cp.case_notes, cp.is_primary, cp.grouped_under_id,
                   cp.assigned_date, cp.created_at as assigned_at,
                   via.name as grouped_under_name
            FROM persons p
            JOIN case_persons cp ON p.id = cp.person_id
            LEFT JOIN persons via ON cp.grouped_under_id = via.id
            WHERE cp.id = %s
        """, (assignment_id,))
        return serialize_row(dict(cur.fetchone()))


def update_case_assignment(case_id: int, person_id: int, role: str, **kwargs) -> Optional[dict]:
    """Update a case-person assignment."""
    allowed_fields = ["side", "case_attributes", "case_notes", "is_primary",
                      "grouped_under_id", "assigned_date"]
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
                   cp.case_notes, cp.is_primary, cp.grouped_under_id,
                   cp.assigned_date, cp.created_at as assigned_at,
                   via.name as grouped_under_name
            FROM persons p
            JOIN case_persons cp ON p.id = cp.person_id
            LEFT JOIN persons via ON cp.grouped_under_id = via.id
            WHERE cp.id = %s
        """, (assignment_id,))
        return serialize_row(dict(cur.fetchone()))


def change_person_role(case_id: int, person_id: int, old_role: str, new_role: str) -> Optional[dict]:
    """Change a person's role on a case.

    Atomically updates the role, clears grouped_under_id on the changed row,
    and clears grouped_under_id on any other rows that were grouped under this person.
    """
    validate_case_person_role(new_role)

    if old_role == new_role:
        return None

    with get_cursor() as cur:
        # Check new role doesn't already exist for this person+case
        cur.execute("""
            SELECT id FROM case_persons
            WHERE case_id = %s AND person_id = %s AND role = %s
        """, (case_id, person_id, new_role))
        if cur.fetchone():
            raise ValidationError(f"Person already has role '{new_role}' on this case")

        # Get the assignment id before updating
        cur.execute("""
            SELECT id FROM case_persons
            WHERE case_id = %s AND person_id = %s AND role = %s
        """, (case_id, person_id, old_role))
        row = cur.fetchone()
        if not row:
            return None
        assignment_id = row["id"]

        # Update role and clear grouped_under_id
        cur.execute("""
            UPDATE case_persons
            SET role = %s, grouped_under_id = NULL
            WHERE id = %s
        """, (new_role, assignment_id))

        # Clear grouped_under_id on anyone grouped under this person in this case
        cur.execute("""
            UPDATE case_persons
            SET grouped_under_id = NULL
            WHERE case_id = %s AND grouped_under_id = %s
        """, (case_id, person_id))

        # Return full assignment details
        cur.execute("""
            SELECT p.id, p.person_type, p.name, p.phones, p.emails, p.organization,
                   p.attributes, p.notes as person_notes,
                   cp.id as assignment_id, cp.role, cp.side, cp.case_attributes,
                   cp.case_notes, cp.is_primary, cp.grouped_under_id,
                   cp.assigned_date, cp.created_at as assigned_at,
                   via.name as grouped_under_name
            FROM persons p
            JOIN case_persons cp ON p.id = cp.person_id
            LEFT JOIN persons via ON cp.grouped_under_id = via.id
            WHERE cp.id = %s
        """, (assignment_id,))
        return serialize_row(dict(cur.fetchone()))


def remove_person_from_case(case_id: int, person_id: int, role: str = None) -> bool:
    """Remove a person from a case. Severs any grouped_under relationships first."""
    with get_cursor() as cur:
        # Clear grouped_under references pointing to this person on this case
        cur.execute("""
            UPDATE case_persons SET grouped_under_id = NULL
            WHERE case_id = %s AND grouped_under_id = %s
        """, (case_id, person_id))

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


# ===== DUPLICATE DETECTION & MERGE =====

def find_duplicate_persons() -> dict:
    """Find groups of potential duplicate persons.

    Detection: exact case-insensitive name match, shared phone, or shared email.
    Returns groups sorted by group size (largest first).
    """
    with get_cursor() as cur:
        # Find name-based duplicates (exact case-insensitive match)
        cur.execute("""
            WITH name_groups AS (
                SELECT LOWER(TRIM(name)) as norm_name, array_agg(id ORDER BY id) as person_ids
                FROM persons
                WHERE archived = false
                GROUP BY LOWER(TRIM(name))
                HAVING COUNT(*) > 1
            )
            SELECT ng.norm_name, ng.person_ids,
                   json_agg(json_build_object(
                       'id', p.id,
                       'person_type', p.person_type,
                       'name', p.name,
                       'phones', p.phones,
                       'emails', p.emails,
                       'organization', p.organization,
                       'attributes', p.attributes,
                       'notes', p.notes
                   ) ORDER BY p.id) as persons
            FROM name_groups ng
            JOIN persons p ON p.id = ANY(ng.person_ids)
            GROUP BY ng.norm_name, ng.person_ids
            ORDER BY array_length(ng.person_ids, 1) DESC, ng.norm_name
        """)

        groups = []
        seen_pairs = set()

        for row in cur.fetchall():
            person_ids = row["person_ids"]
            pair_key = tuple(sorted(person_ids))
            if pair_key in seen_pairs:
                continue
            seen_pairs.add(pair_key)

            persons = row["persons"] if isinstance(row["persons"], list) else json.loads(row["persons"])

            # Check for assignment conflicts
            has_conflicts = _check_merge_conflicts(cur, person_ids)

            groups.append({
                "persons": persons,
                "match_reasons": ["exact_name"],
                "has_conflicts": has_conflicts,
            })

        return {"groups": groups, "total": len(groups)}


def _check_merge_conflicts(cur, person_ids: list) -> bool:
    """Check if merging a group of persons would have assignment conflicts."""
    if len(person_ids) < 2:
        return False

    # Check for overlapping case_persons assignments (same case_id + role)
    cur.execute("""
        SELECT case_id, role, COUNT(DISTINCT person_id) as cnt
        FROM case_persons
        WHERE person_id = ANY(%s)
        GROUP BY case_id, role
        HAVING COUNT(DISTINCT person_id) > 1
    """, (person_ids,))
    if cur.fetchone():
        return True

    # Check for overlapping judge assignments (same proceeding_id)
    cur.execute("""
        SELECT proceeding_id, COUNT(DISTINCT person_id) as cnt
        FROM judges
        WHERE person_id = ANY(%s)
        GROUP BY proceeding_id
        HAVING COUNT(DISTINCT person_id) > 1
    """, (person_ids,))
    if cur.fetchone():
        return True

    # Check for different person_types
    cur.execute("""
        SELECT COUNT(DISTINCT person_type) FROM persons
        WHERE id = ANY(%s)
    """, (person_ids,))
    if cur.fetchone()["count"] > 1:
        return True

    # Check for conflicting scalar fields (both non-empty and different)
    cur.execute("""
        SELECT id, person_type, name, organization, address FROM persons
        WHERE id = ANY(%s) ORDER BY id
    """, (person_ids,))
    rows = [dict(r) for r in cur.fetchall()]
    if len(rows) >= 2:
        p, s = rows[0], rows[1]
        for field in ['organization', 'address']:
            pv = (p.get(field) or '').strip()
            sv = (s.get(field) or '').strip()
            if pv and sv and pv.lower() != sv.lower():
                return True

    return False


def preview_merge(primary_id: int, secondary_id: int) -> dict:
    """Preview what a merge would look like, identifying conflicts."""
    with get_cursor() as cur:
        # Fetch both persons with full details
        primary = get_person_by_id(primary_id)
        secondary = get_person_by_id(secondary_id)
        if not primary or not secondary:
            return {"error": "One or both persons not found"}

        # Find field conflicts (both non-empty and different)
        field_conflicts = []
        for field in ['name', 'person_type', 'organization', 'address']:
            pv = (primary.get(field) or '')
            sv = (secondary.get(field) or '')
            if isinstance(pv, str):
                pv = pv.strip()
            if isinstance(sv, str):
                sv = sv.strip()
            if pv and sv and str(pv).lower() != str(sv).lower():
                field_conflicts.append({
                    "field": field,
                    "primary_value": primary.get(field),
                    "secondary_value": secondary.get(field),
                })

        # Check notes conflict
        pn = (primary.get('notes') or '').strip()
        sn = (secondary.get('notes') or '').strip()
        if pn and sn and pn != sn:
            field_conflicts.append({
                "field": "notes",
                "primary_value": primary.get('notes'),
                "secondary_value": secondary.get('notes'),
            })

        # Find assignment conflicts (same case_id + role for both persons)
        cur.execute("""
            SELECT cp1.case_id, cp1.role, c.case_name, c.short_name
            FROM case_persons cp1
            JOIN case_persons cp2 ON cp1.case_id = cp2.case_id AND cp1.role = cp2.role
            JOIN cases c ON cp1.case_id = c.id
            WHERE cp1.person_id = %s AND cp2.person_id = %s
        """, (primary_id, secondary_id))
        assignment_conflicts = [{
            "case_id": row["case_id"],
            "role": row["role"],
            "case_name": row["case_name"],
            "short_name": row["short_name"],
        } for row in cur.fetchall()]

        # Find judge conflicts (same proceeding_id)
        cur.execute("""
            SELECT j1.proceeding_id, pr.case_number as proceeding_name
            FROM judges j1
            JOIN judges j2 ON j1.proceeding_id = j2.proceeding_id
            JOIN proceedings pr ON j1.proceeding_id = pr.id
            WHERE j1.person_id = %s AND j2.person_id = %s
        """, (primary_id, secondary_id))
        judge_conflicts = [{
            "proceeding_id": row["proceeding_id"],
            "proceeding_name": row["proceeding_name"],
        } for row in cur.fetchall()]

        auto_mergeable = (
            len(field_conflicts) == 0 and
            len(assignment_conflicts) == 0 and
            len(judge_conflicts) == 0
        )

        return {
            "primary": primary,
            "secondary": secondary,
            "conflicts": {
                "field_conflicts": field_conflicts,
                "assignment_conflicts": assignment_conflicts,
                "judge_conflicts": judge_conflicts,
            },
            "auto_mergeable": auto_mergeable,
        }


def merge_persons(primary_id: int, secondary_id: int,
                  field_resolutions: dict = None) -> dict:
    """Merge secondary person into primary person.

    Steps (in a single transaction):
    1. Reassign case_persons from secondary -> primary (skip constraint conflicts)
    2. Reassign case_persons.grouped_under_id from secondary -> primary
    3. Reassign judges from secondary -> primary (skip constraint conflicts)
    4. Update primary person's fields per resolutions
    5. Delete secondary person

    field_resolutions: dict mapping field names to 'primary' or 'secondary'
      e.g. {"name": "primary", "organization": "secondary", "notes": "concatenate"}
      For phones/emails, always unions. For attributes, always merges.
    """
    if not field_resolutions:
        field_resolutions = {}

    with get_cursor() as cur:
        # Fetch both persons
        cur.execute("SELECT * FROM persons WHERE id = %s", (primary_id,))
        primary = cur.fetchone()
        cur.execute("SELECT * FROM persons WHERE id = %s", (secondary_id,))
        secondary = cur.fetchone()

        if not primary or not secondary:
            return {"error": "One or both persons not found"}

        primary = dict(primary)
        secondary = dict(secondary)

        # 1. Reassign case_persons (skip conflicts)
        # First delete secondary's assignments that would conflict
        cur.execute("""
            DELETE FROM case_persons
            WHERE person_id = %s
            AND (case_id, role) IN (
                SELECT case_id, role FROM case_persons WHERE person_id = %s
            )
        """, (secondary_id, primary_id))

        # Now reassign remaining
        cur.execute("""
            UPDATE case_persons SET person_id = %s
            WHERE person_id = %s
        """, (primary_id, secondary_id))

        # 2. Reassign grouped_under_id references
        cur.execute("""
            UPDATE case_persons SET grouped_under_id = %s
            WHERE grouped_under_id = %s
        """, (primary_id, secondary_id))

        # Clear any circular grouped_under (primary grouped under itself)
        cur.execute("""
            UPDATE case_persons SET grouped_under_id = NULL
            WHERE person_id = %s AND grouped_under_id = %s
        """, (primary_id, primary_id))

        # 3. Reassign judges (skip conflicts)
        cur.execute("""
            DELETE FROM judges
            WHERE person_id = %s
            AND proceeding_id IN (
                SELECT proceeding_id FROM judges WHERE person_id = %s
            )
        """, (secondary_id, primary_id))

        cur.execute("""
            UPDATE judges SET person_id = %s
            WHERE person_id = %s
        """, (primary_id, secondary_id))

        # 4. Merge person fields
        updates = {}

        # Scalar fields - use resolution or pick non-empty
        for field in ['name', 'person_type', 'organization', 'address']:
            resolution = field_resolutions.get(field)
            if resolution == 'secondary':
                if secondary.get(field):
                    updates[field] = secondary[field]
            elif resolution == 'primary':
                pass  # Keep primary's value
            else:
                # Auto: use primary if non-empty, else secondary
                pv = primary.get(field)
                sv = secondary.get(field)
                if not pv and sv:
                    updates[field] = sv

        # Notes - concatenate or pick
        notes_resolution = field_resolutions.get('notes', 'concatenate')
        pn = (primary.get('notes') or '').strip()
        sn = (secondary.get('notes') or '').strip()
        if notes_resolution == 'secondary':
            if sn:
                updates['notes'] = sn
        elif notes_resolution == 'primary':
            pass
        elif notes_resolution == 'concatenate':
            if pn and sn:
                updates['notes'] = f"{pn}\n\n---\n\n{sn}"
            elif sn:
                updates['notes'] = sn

        # Phones - union by value
        p_phones = primary.get('phones') or []
        s_phones = secondary.get('phones') or []
        if isinstance(p_phones, str):
            p_phones = json.loads(p_phones)
        if isinstance(s_phones, str):
            s_phones = json.loads(s_phones)
        existing_values = {p.get('value', '') for p in p_phones}
        for phone in s_phones:
            if phone.get('value', '') not in existing_values:
                p_phones.append(phone)
                existing_values.add(phone.get('value', ''))
        if len(p_phones) > len(primary.get('phones') or []):
            updates['phones'] = json.dumps(p_phones)

        # Emails - union by value
        p_emails = primary.get('emails') or []
        s_emails = secondary.get('emails') or []
        if isinstance(p_emails, str):
            p_emails = json.loads(p_emails)
        if isinstance(s_emails, str):
            s_emails = json.loads(s_emails)
        existing_values = {e.get('value', '').lower() for e in p_emails}
        for email in s_emails:
            if email.get('value', '').lower() not in existing_values:
                p_emails.append(email)
                existing_values.add(email.get('value', '').lower())
        if len(p_emails) > len(primary.get('emails') or []):
            updates['emails'] = json.dumps(p_emails)

        # Attributes - merge keys (primary wins on conflict)
        p_attrs = primary.get('attributes') or {}
        s_attrs = secondary.get('attributes') or {}
        if isinstance(p_attrs, str):
            p_attrs = json.loads(p_attrs)
        if isinstance(s_attrs, str):
            s_attrs = json.loads(s_attrs)
        merged_attrs = {**s_attrs, **p_attrs}  # primary wins
        if merged_attrs != p_attrs:
            updates['attributes'] = json.dumps(merged_attrs)

        # Apply updates to primary
        if updates:
            set_clauses = []
            params = []
            for field, value in updates.items():
                set_clauses.append(f"{field} = %s")
                params.append(value)
            set_clauses.append("updated_at = CURRENT_TIMESTAMP")
            params.append(primary_id)
            cur.execute(f"""
                UPDATE persons SET {', '.join(set_clauses)}
                WHERE id = %s
            """, params)

        # 5. Delete secondary person
        cur.execute("DELETE FROM persons WHERE id = %s", (secondary_id,))

    return get_person_by_id(primary_id)


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
                   cp.case_notes, cp.is_primary, cp.grouped_under_id,
                   cp.assigned_date, cp.created_at as assigned_at,
                   via.name as grouped_under_name
            FROM persons p
            JOIN case_persons cp ON p.id = cp.person_id
            LEFT JOIN persons via ON cp.grouped_under_id = via.id
            WHERE {where_clause}
            ORDER BY cp.role, p.name
        """, params)

        return [dict(row) for row in cur.fetchall()]
