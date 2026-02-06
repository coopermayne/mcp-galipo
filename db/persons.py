"""
Person/contact management functions.

The unified roles schema:
- persons table: simplified identity (name, contact info only - no person_type)
- roles table: role definitions with categories
- person_roles: junction table linking persons to roles with optional case_id
"""

import json
from typing import Optional, List

from .connection import get_cursor, serialize_row, serialize_rows
from .validation import validate_date_format, ValidationError


def _validate_and_ensure_expertises(cur, role_id: int, attributes: dict) -> dict:
    """Validate expertise list for expert roles and auto-create missing types.

    For roles with category='expert', ensures attributes.expertises is a list
    of strings that all exist in the expertise_types table. Missing types are
    created on the fly.
    """
    if not attributes:
        return attributes

    expertises = attributes.get("expertises")
    if expertises is None:
        return attributes

    # Only validate expertises for expert roles
    cur.execute("SELECT category FROM roles WHERE id = %s", (role_id,))
    role_row = cur.fetchone()
    if not role_row or role_row["category"] != "expert":
        return attributes

    if not isinstance(expertises, list):
        raise ValidationError("expertises must be a list")
    if not all(isinstance(e, str) and e.strip() for e in expertises):
        raise ValidationError("each expertise must be a non-empty string")

    # Auto-create missing expertise types
    for name in expertises:
        cur.execute("SELECT id FROM expertise_types WHERE name = %s", (name,))
        if not cur.fetchone():
            cur.execute(
                "INSERT INTO expertise_types (name) VALUES (%s) ON CONFLICT (name) DO NOTHING",
                (name,)
            )

    return attributes


def create_person(name: str, phones: List[dict] = None, emails: List[dict] = None,
                  address: str = None, organization: str = None,
                  notes: str = None) -> dict:
    """Create a new person (without any role assignment)."""
    phones_json = json.dumps(phones) if phones else '[]'
    emails_json = json.dumps(emails) if emails else '[]'

    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO persons (name, phones, emails, address, organization, notes)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, name, phones, emails, address, organization, notes,
                      created_at, updated_at, archived
        """, (name, phones_json, emails_json, address, organization, notes))
        return serialize_row(dict(cur.fetchone()))


def get_person_by_id(person_id: int) -> Optional[dict]:
    """Get person by ID with their role assignments."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT id, name, phones, emails, address, organization,
                   notes, created_at, updated_at, archived
            FROM persons WHERE id = %s
        """, (person_id,))
        person = cur.fetchone()
        if not person:
            return None

        result = serialize_row(dict(person))

        # Get role assignments (both case-specific and standalone)
        cur.execute("""
            SELECT pr.id as assignment_id, pr.role_id, pr.case_id,
                   pr.attributes, pr.notes as role_notes, pr.is_primary,
                   pr.grouped_under_id, pr.assigned_date, pr.created_at,
                   r.name as role_name, r.category as role_category,
                   c.case_name, c.short_name, c.color as case_color,
                   via.name as grouped_under_name
            FROM person_roles pr
            JOIN roles r ON pr.role_id = r.id
            LEFT JOIN cases c ON pr.case_id = c.id
            LEFT JOIN persons via ON pr.grouped_under_id = via.id
            WHERE pr.person_id = %s
            ORDER BY c.case_name NULLS FIRST, r.category, r.sort_order
        """, (person_id,))
        roles = []
        for row in cur.fetchall():
            role_data = serialize_row(dict(row))
            # Nest the role object for frontend compatibility
            role_data["role"] = {
                "id": role_data["role_id"],
                "name": role_data.pop("role_name"),
                "category": role_data.pop("role_category"),
            }
            role_data["color"] = role_data.pop("case_color", None)
            roles.append(role_data)
        result["roles"] = roles

        return result


def update_person(person_id: int, **kwargs) -> Optional[dict]:
    """Update person fields."""
    allowed_fields = ["name", "phones", "emails", "address", "organization", "notes"]
    updates = []
    params = []

    for field, value in kwargs.items():
        if field not in allowed_fields:
            continue
        if value is None:
            continue

        if field in ["phones", "emails"]:
            value = json.dumps(value) if isinstance(value, list) else value

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


def search_persons(name: str = None, role_id: int = None, category: str = None,
                   organization: str = None, email: str = None, phone: str = None,
                   case_id: int = None, unassigned: bool = False,
                   include_roles: bool = False, user_id: int = None,
                   limit: int = 50, offset: int = 0) -> dict:
    """Search persons by various criteria."""
    conditions = ["p.archived = false"]
    params = []

    if name:
        conditions.append("p.name ILIKE %s")
        params.append(f"%{name}%")

    if organization:
        conditions.append("p.organization ILIKE %s")
        params.append(f"%{organization}%")

    if email:
        conditions.append("p.emails::text ILIKE %s")
        params.append(f"%{email}%")

    if phone:
        conditions.append("p.phones::text ILIKE %s")
        params.append(f"%{phone}%")

    if role_id:
        conditions.append("EXISTS (SELECT 1 FROM person_roles pr WHERE pr.person_id = p.id AND pr.role_id = %s)")
        params.append(role_id)

    if category:
        conditions.append("""EXISTS (
            SELECT 1 FROM person_roles pr
            JOIN roles r ON pr.role_id = r.id
            WHERE pr.person_id = p.id AND r.category = %s
        )""")
        params.append(category)

    if case_id:
        conditions.append("EXISTS (SELECT 1 FROM person_roles pr WHERE pr.person_id = p.id AND pr.case_id = %s)")
        params.append(case_id)

    if unassigned:
        conditions.append("NOT EXISTS (SELECT 1 FROM person_roles pr WHERE pr.person_id = p.id)")

    if user_id:
        conditions.append("""EXISTS (
            SELECT 1 FROM person_roles pr
            JOIN cases c ON pr.case_id = c.id
            WHERE pr.person_id = p.id
            AND (%s = ANY(c.attorney_ids) OR %s = ANY(c.paralegal_ids))
        )""")
        params.append(user_id)
        params.append(user_id)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with get_cursor() as cur:
        cur.execute(f"SELECT COUNT(*) as total FROM persons p {where_clause}", params)
        total = cur.fetchone()["total"]

        cur.execute(f"""
            SELECT p.id, p.name, p.phones, p.emails, p.organization,
                   p.notes, p.archived, p.created_at
            FROM persons p
            {where_clause}
            ORDER BY p.name
            LIMIT %s OFFSET %s
        """, params + [limit, offset])

        persons = serialize_rows([dict(row) for row in cur.fetchall()])

        if include_roles and persons:
            person_ids = [p["id"] for p in persons]
            cur.execute("""
                SELECT pr.person_id, pr.id as assignment_id, pr.role_id, pr.case_id,
                       r.name as role_name, r.category,
                       c.case_name, c.short_name, c.color as case_color
                FROM person_roles pr
                JOIN roles r ON pr.role_id = r.id
                LEFT JOIN cases c ON pr.case_id = c.id
                WHERE pr.person_id = ANY(%s)
                ORDER BY c.case_name NULLS FIRST, r.category, r.sort_order
            """, (person_ids,))

            # Build a map of person_id -> list of roles
            roles_map: dict = {}
            for row in cur.fetchall():
                pid = row["person_id"]
                if pid not in roles_map:
                    roles_map[pid] = []
                roles_map[pid].append({
                    "assignment_id": row["assignment_id"],
                    "role_id": row["role_id"],
                    "role": {
                        "id": row["role_id"],
                        "name": row["role_name"],
                        "category": row["category"],
                    },
                    "case_id": row["case_id"],
                    "case_name": row["case_name"],
                    "short_name": row["short_name"],
                    "color": row["case_color"],
                })
            for p in persons:
                p["roles"] = roles_map.get(p["id"], [])

        return {"persons": persons, "total": total}


def delete_person(person_id: int) -> bool:
    """Permanently delete a person. Clears grouped_under references first."""
    with get_cursor() as cur:
        cur.execute("UPDATE person_roles SET grouped_under_id = NULL WHERE grouped_under_id = %s", (person_id,))
        cur.execute("DELETE FROM persons WHERE id = %s", (person_id,))
        return cur.rowcount > 0


def archive_person(person_id: int) -> Optional[dict]:
    """Archive a person (soft delete)."""
    with get_cursor() as cur:
        cur.execute("""
            UPDATE persons SET archived = true, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s RETURNING id
        """, (person_id,))
        if not cur.fetchone():
            return None
    return get_person_by_id(person_id)


# ===== CASE-PERSON ROLE OPERATIONS =====

def assign_person_to_case(case_id: int, person_id: int, role_id: int,
                          attributes: dict = None, notes: str = None,
                          is_primary: bool = False, grouped_under_id: int = None,
                          assigned_date: str = None) -> dict:
    """Assign a person to a case with a specific role."""
    validate_date_format(assigned_date, "assigned_date")

    with get_cursor() as cur:
        # Validate expertises for expert roles (auto-creates missing types)
        if attributes:
            _validate_and_ensure_expertises(cur, role_id, attributes)

        attrs_json = json.dumps(attributes) if attributes else '{}'
        # Check if assignment already exists (partial unique index prevents ON CONFLICT)
        cur.execute("""
            SELECT id FROM person_roles
            WHERE person_id = %s AND role_id = %s AND case_id = %s
        """, (person_id, role_id, case_id))
        existing = cur.fetchone()

        if existing:
            # Update existing assignment
            cur.execute("""
                UPDATE person_roles SET
                    attributes = %s,
                    notes = %s,
                    is_primary = %s,
                    grouped_under_id = %s,
                    assigned_date = %s
                WHERE id = %s
                RETURNING id
            """, (attrs_json, notes, is_primary, grouped_under_id, assigned_date, existing["id"]))
            assignment_id = cur.fetchone()["id"]
        else:
            # Insert new assignment
            cur.execute("""
                INSERT INTO person_roles (person_id, role_id, case_id, attributes,
                                          notes, is_primary, grouped_under_id, assigned_date)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (person_id, role_id, case_id, attrs_json, notes,
                  is_primary, grouped_under_id, assigned_date))
            assignment_id = cur.fetchone()["id"]

        # Return full assignment details
        cur.execute("""
            SELECT p.id, p.name, p.phones, p.emails, p.organization, p.notes as person_notes,
                   pr.id as assignment_id, pr.role_id, pr.attributes, pr.notes as role_notes,
                   pr.is_primary, pr.grouped_under_id, pr.assigned_date, pr.created_at as assigned_at,
                   r.name as role_name, r.category as role_category,
                   via.name as grouped_under_name
            FROM persons p
            JOIN person_roles pr ON p.id = pr.person_id
            JOIN roles r ON pr.role_id = r.id
            LEFT JOIN persons via ON pr.grouped_under_id = via.id
            WHERE pr.id = %s
        """, (assignment_id,))
        return serialize_row(dict(cur.fetchone()))


def update_case_assignment(assignment_id: int, **kwargs) -> Optional[dict]:
    """Update a person_roles assignment by ID."""
    allowed_fields = ["attributes", "notes", "is_primary", "grouped_under_id", "assigned_date"]
    updates = []
    params = []

    with get_cursor() as cur:
        # If attributes are being updated, validate expertises for expert roles
        if "attributes" in kwargs and isinstance(kwargs["attributes"], dict):
            cur.execute("SELECT role_id FROM person_roles WHERE id = %s", (assignment_id,))
            pr_row = cur.fetchone()
            if pr_row:
                _validate_and_ensure_expertises(cur, pr_row["role_id"], kwargs["attributes"])

        for field, value in kwargs.items():
            if field not in allowed_fields:
                continue

            if field == "assigned_date" and value:
                validate_date_format(value, "assigned_date")
            elif field == "attributes":
                value = json.dumps(value) if isinstance(value, dict) else value

            updates.append(f"{field} = %s")
            params.append(value)

        if not updates:
            return None

        params.append(assignment_id)
        cur.execute(f"""
            UPDATE person_roles SET {', '.join(updates)}
            WHERE id = %s
            RETURNING id
        """, params)
        row = cur.fetchone()
        if not row:
            return None

        cur.execute("""
            SELECT p.id, p.name, p.phones, p.emails, p.organization, p.notes as person_notes,
                   pr.id as assignment_id, pr.role_id, pr.attributes, pr.notes as role_notes,
                   pr.is_primary, pr.grouped_under_id, pr.assigned_date, pr.created_at as assigned_at,
                   r.name as role_name, r.category as role_category,
                   via.name as grouped_under_name
            FROM persons p
            JOIN person_roles pr ON p.id = pr.person_id
            JOIN roles r ON pr.role_id = r.id
            LEFT JOIN persons via ON pr.grouped_under_id = via.id
            WHERE pr.id = %s
        """, (assignment_id,))
        return serialize_row(dict(cur.fetchone()))


def change_person_role_on_case(case_id: int, person_id: int, old_role_id: int,
                               new_role_id: int) -> Optional[dict]:
    """Change a person's role on a case.

    Atomically updates the role, clears grouped_under_id on the changed row,
    and clears grouped_under_id on any other rows that were grouped under this person.
    """
    from .validation import ValidationError

    if old_role_id == new_role_id:
        return None

    with get_cursor() as cur:
        # Check new role doesn't already exist for this person+case
        cur.execute("""
            SELECT id FROM person_roles
            WHERE case_id = %s AND person_id = %s AND role_id = %s
        """, (case_id, person_id, new_role_id))
        if cur.fetchone():
            raise ValidationError(f"Person already has this role on this case")

        # Get the assignment id before updating
        cur.execute("""
            SELECT id FROM person_roles
            WHERE case_id = %s AND person_id = %s AND role_id = %s
        """, (case_id, person_id, old_role_id))
        row = cur.fetchone()
        if not row:
            return None
        assignment_id = row["id"]

        # Update role and clear grouped_under_id
        cur.execute("""
            UPDATE person_roles
            SET role_id = %s, grouped_under_id = NULL
            WHERE id = %s
        """, (new_role_id, assignment_id))

        # Clear grouped_under_id on anyone grouped under this person in this case
        cur.execute("""
            UPDATE person_roles
            SET grouped_under_id = NULL
            WHERE case_id = %s AND grouped_under_id = %s
        """, (case_id, person_id))

        # Return full assignment details
        cur.execute("""
            SELECT p.id, p.name, p.phones, p.emails, p.organization, p.notes as person_notes,
                   pr.id as assignment_id, pr.role_id, pr.attributes, pr.notes as role_notes,
                   pr.is_primary, pr.grouped_under_id, pr.assigned_date, pr.created_at as assigned_at,
                   r.name as role_name, r.category as role_category,
                   via.name as grouped_under_name
            FROM persons p
            JOIN person_roles pr ON p.id = pr.person_id
            JOIN roles r ON pr.role_id = r.id
            LEFT JOIN persons via ON pr.grouped_under_id = via.id
            WHERE pr.id = %s
        """, (assignment_id,))
        return serialize_row(dict(cur.fetchone()))


def remove_person_from_case(case_id: int, person_id: int, role_id: int = None) -> bool:
    """Remove a person from a case. Severs any grouped_under relationships first."""
    with get_cursor() as cur:
        # Clear grouped_under references pointing to this person on this case
        cur.execute("""
            UPDATE person_roles SET grouped_under_id = NULL
            WHERE case_id = %s AND grouped_under_id = %s
        """, (case_id, person_id))

        if role_id:
            cur.execute("""
                DELETE FROM person_roles
                WHERE case_id = %s AND person_id = %s AND role_id = %s
            """, (case_id, person_id, role_id))
        else:
            cur.execute("""
                DELETE FROM person_roles
                WHERE case_id = %s AND person_id = %s
            """, (case_id, person_id))
        return cur.rowcount > 0


# ===== CASE PERSONS QUERY =====

def get_case_persons(case_id: int, role_id: int = None, category: str = None) -> List[dict]:
    """Get all persons assigned to a case with optional filters."""
    conditions = ["pr.case_id = %s"]
    params = [case_id]

    if role_id:
        conditions.append("pr.role_id = %s")
        params.append(role_id)

    if category:
        conditions.append("r.category = %s")
        params.append(category)

    where_clause = " AND ".join(conditions)

    with get_cursor() as cur:
        cur.execute(f"""
            SELECT p.id, p.name, p.phones, p.emails, p.organization, p.notes as person_notes,
                   pr.id as assignment_id, pr.role_id, pr.attributes, pr.notes as role_notes,
                   pr.is_primary, pr.grouped_under_id, pr.assigned_date, pr.created_at as assigned_at,
                   r.name as role_name, r.category as role_category, r.sort_order as role_sort_order,
                   via.name as grouped_under_name
            FROM persons p
            JOIN person_roles pr ON p.id = pr.person_id
            JOIN roles r ON pr.role_id = r.id
            LEFT JOIN persons via ON pr.grouped_under_id = via.id
            WHERE {where_clause}
            ORDER BY r.category, r.sort_order, p.name
        """, params)

        results = []
        for row in cur.fetchall():
            person = serialize_row(dict(row))
            # Nest the role object for frontend compatibility
            person["role"] = {
                "id": person["role_id"],
                "name": person.pop("role_name"),
                "category": person.pop("role_category"),
            }
            person.pop("role_sort_order", None)
            results.append(person)
        return results


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
                       'name', p.name,
                       'phones', p.phones,
                       'emails', p.emails,
                       'organization', p.organization,
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

    # Check for overlapping person_roles assignments (same case_id + role_id)
    cur.execute("""
        SELECT case_id, role_id, COUNT(DISTINCT person_id) as cnt
        FROM person_roles
        WHERE person_id = ANY(%s) AND case_id IS NOT NULL
        GROUP BY case_id, role_id
        HAVING COUNT(DISTINCT person_id) > 1
    """, (person_ids,))
    if cur.fetchone():
        return True

    # Check for conflicting scalar fields (both non-empty and different)
    cur.execute("""
        SELECT id, name, organization, address FROM persons
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
        for field in ['name', 'organization', 'address']:
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

        # Find assignment conflicts (same case_id + role_id for both persons)
        cur.execute("""
            SELECT pr1.case_id, pr1.role_id, c.case_name, c.short_name, r.name as role_name
            FROM person_roles pr1
            JOIN person_roles pr2 ON pr1.case_id = pr2.case_id AND pr1.role_id = pr2.role_id
            JOIN cases c ON pr1.case_id = c.id
            JOIN roles r ON pr1.role_id = r.id
            WHERE pr1.person_id = %s AND pr2.person_id = %s
        """, (primary_id, secondary_id))
        assignment_conflicts = [{
            "case_id": row["case_id"],
            "role_id": row["role_id"],
            "role_name": row["role_name"],
            "case_name": row["case_name"],
            "short_name": row["short_name"],
        } for row in cur.fetchall()]

        auto_mergeable = (
            len(field_conflicts) == 0 and
            len(assignment_conflicts) == 0
        )

        return {
            "primary": primary,
            "secondary": secondary,
            "conflicts": {
                "field_conflicts": field_conflicts,
                "assignment_conflicts": assignment_conflicts,
            },
            "auto_mergeable": auto_mergeable,
        }


def merge_persons(primary_id: int, secondary_id: int,
                  field_resolutions: dict = None) -> dict:
    """Merge secondary person into primary person.

    Steps (in a single transaction):
    1. Reassign person_roles from secondary -> primary (skip constraint conflicts)
    2. Reassign person_roles.grouped_under_id from secondary -> primary
    3. Update primary person's fields per resolutions
    4. Delete secondary person

    field_resolutions: dict mapping field names to 'primary' or 'secondary'
      e.g. {"name": "primary", "organization": "secondary", "notes": "concatenate"}
      For phones/emails, always unions.
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

        # 1. Reassign person_roles (skip conflicts)
        # First delete secondary's assignments that would conflict
        cur.execute("""
            DELETE FROM person_roles
            WHERE person_id = %s
            AND (case_id, role_id) IN (
                SELECT case_id, role_id FROM person_roles WHERE person_id = %s AND case_id IS NOT NULL
            )
        """, (secondary_id, primary_id))

        # Now reassign remaining
        cur.execute("""
            UPDATE person_roles SET person_id = %s
            WHERE person_id = %s
        """, (primary_id, secondary_id))

        # 2. Reassign grouped_under_id references
        cur.execute("""
            UPDATE person_roles SET grouped_under_id = %s
            WHERE grouped_under_id = %s
        """, (primary_id, secondary_id))

        # Clear any circular grouped_under (primary grouped under itself)
        cur.execute("""
            UPDATE person_roles SET grouped_under_id = NULL
            WHERE person_id = %s AND grouped_under_id = %s
        """, (primary_id, primary_id))

        # 3. Merge person fields
        updates = {}

        # Scalar fields - use resolution or pick non-empty
        for field in ['name', 'organization', 'address']:
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

        # 4. Delete secondary person
        cur.execute("DELETE FROM persons WHERE id = %s", (secondary_id,))

    return get_person_by_id(primary_id)
