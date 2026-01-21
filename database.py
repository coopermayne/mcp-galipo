"""
Database module for PostgreSQL connection and operations.

Uses DATABASE_URL environment variable (provided by Coolify).
Implements normalized schema for personal injury litigation practice.
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from typing import Optional, List

DATABASE_URL = os.environ.get("DATABASE_URL")

# Valid statuses and roles
CASE_STATUSES = [
    "Signing Up", "Prospective", "Pre-Filing", "Pleadings", "Discovery",
    "Expert Discovery", "Pre-trial", "Trial", "Post-Trial", "Appeal",
    "Settl. Pend.", "Stayed", "Closed"
]

CONTACT_ROLES = [
    "Opposing Counsel", "Co-Counsel", "Referring Attorney", "Mediator",
    "Judge", "Magistrate Judge", "Plaintiff Expert", "Defendant Expert",
    "Witness", "Client Contact", "Guardian Ad Litem", "Family Contact"
]

TASK_STATUSES = [
    "Pending", "Active", "Done", "Partially Done", "Blocked", "Awaiting Atty Review"
]

COURT_OPTIONS = [
    # California Federal Courts
    "C.D. Cal.", "E.D. Cal.", "N.D. Cal.", "S.D. Cal.",
    # California State Courts
    "Superior Court - Los Angeles", "Superior Court - Orange", "Superior Court - San Diego",
    "Superior Court - Riverside", "Superior Court - San Bernardino", "Superior Court - Ventura",
    "Superior Court - Santa Barbara", "Superior Court - Kern", "Superior Court - San Francisco",
    "Superior Court - Alameda", "Superior Court - Santa Clara", "Superior Court - Sacramento",
    # Other
    "Other"
]

ACTIVITY_TYPES = [
    "Meeting", "Filing", "Research", "Drafting", "Document Review",
    "Phone Call", "Email", "Court Appearance", "Deposition", "Other"
]


class ValidationError(Exception):
    """Raised when input validation fails."""
    pass


def validate_case_status(status: str) -> str:
    """Validate case status against allowed values."""
    if status not in CASE_STATUSES:
        raise ValidationError(f"Invalid case status '{status}'. Must be one of: {', '.join(CASE_STATUSES)}")
    return status


def validate_contact_role(role: str) -> str:
    """Validate contact role against allowed values."""
    if role not in CONTACT_ROLES:
        raise ValidationError(f"Invalid contact role '{role}'. Must be one of: {', '.join(CONTACT_ROLES)}")
    return role


def validate_task_status(status: str) -> str:
    """Validate task status against allowed values."""
    if status not in TASK_STATUSES:
        raise ValidationError(f"Invalid task status '{status}'. Must be one of: {', '.join(TASK_STATUSES)}")
    return status


def validate_urgency(urgency: int) -> int:
    """Validate urgency is between 1 and 5."""
    if not isinstance(urgency, int) or urgency < 1 or urgency > 5:
        raise ValidationError(f"Invalid urgency '{urgency}'. Must be an integer between 1 and 5.")
    return urgency


def validate_date_format(date_str: str, field_name: str = "date") -> str:
    """Validate date string is in YYYY-MM-DD format."""
    if date_str is None:
        return None
    import re
    if not re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
        raise ValidationError(f"Invalid {field_name} format '{date_str}'. Must be YYYY-MM-DD.")
    return date_str


@contextmanager
def get_connection():
    """Context manager for database connections."""
    conn = psycopg2.connect(DATABASE_URL)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@contextmanager
def get_cursor(dict_cursor=True):
    """Context manager for database cursors."""
    with get_connection() as conn:
        cursor_factory = RealDictCursor if dict_cursor else None
        cursor = conn.cursor(cursor_factory=cursor_factory)
        try:
            yield cursor
        finally:
            cursor.close()


def drop_all_tables():
    """Drop all existing tables for clean migration."""
    with get_cursor(dict_cursor=False) as cur:
        cur.execute("""
            DROP TABLE IF EXISTS notes CASCADE;
            DROP TABLE IF EXISTS tasks CASCADE;
            DROP TABLE IF EXISTS deadlines CASCADE;
            DROP TABLE IF EXISTS activities CASCADE;
            DROP TABLE IF EXISTS case_defendants CASCADE;
            DROP TABLE IF EXISTS defendants CASCADE;
            DROP TABLE IF EXISTS case_contacts CASCADE;
            DROP TABLE IF EXISTS contacts CASCADE;
            DROP TABLE IF EXISTS case_numbers CASCADE;
            DROP TABLE IF EXISTS case_clients CASCADE;
            DROP TABLE IF EXISTS clients CASCADE;
            DROP TABLE IF EXISTS cases CASCADE;
        """)
    print("All tables dropped.")


def migrate_case_numbers_to_jsonb():
    """
    Migrate case_numbers from separate table to JSONB column in cases.
    This is a one-time migration for existing databases.
    """
    with get_cursor(dict_cursor=False) as cur:
        # Check if old case_numbers table exists
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'case_numbers'
            )
        """)
        table_exists = cur.fetchone()[0]

        if not table_exists:
            print("No case_numbers table found - migration not needed.")
            return

        # Check if cases table has case_numbers column
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_name = 'cases' AND column_name = 'case_numbers'
            )
        """)
        column_exists = cur.fetchone()[0]

        if not column_exists:
            # Add the JSONB column
            cur.execute("ALTER TABLE cases ADD COLUMN case_numbers JSONB DEFAULT '[]'")
            print("Added case_numbers JSONB column to cases table.")

        # Migrate data from case_numbers table to JSONB column
        cur.execute("""
            UPDATE cases c
            SET case_numbers = COALESCE(
                (SELECT json_agg(
                    json_build_object(
                        'number', cn.case_number,
                        'label', cn.label,
                        'primary', cn.is_primary
                    )
                )
                FROM case_numbers cn
                WHERE cn.case_id = c.id),
                '[]'::json
            )
        """)

        # Get count of migrated records
        cur.execute("SELECT COUNT(*) FROM case_numbers")
        count = cur.fetchone()[0]

        # Drop the old table
        cur.execute("DROP TABLE IF EXISTS case_numbers CASCADE")

        print(f"Migrated {count} case numbers to JSONB and dropped case_numbers table.")


def init_db():
    """Create tables if they don't exist."""
    with get_cursor(dict_cursor=False) as cur:
        # 1. Cases table (case_numbers stored as JSONB)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS cases (
                id SERIAL PRIMARY KEY,
                case_name VARCHAR(255) NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'Signing Up',
                court VARCHAR(255),
                print_code VARCHAR(50),
                case_summary TEXT,
                date_of_injury DATE,
                claim_due DATE,
                claim_filed_date DATE,
                complaint_due DATE,
                complaint_filed_date DATE,
                trial_date DATE,
                case_numbers JSONB DEFAULT '[]',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 2. Clients table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS clients (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                phone VARCHAR(50),
                email VARCHAR(255),
                address TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 3. Contacts table (must be created before case_clients for FK reference)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS contacts (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                firm VARCHAR(255),
                phone VARCHAR(50),
                email VARCHAR(255),
                address TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 4. Case_clients junction table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS case_clients (
                id SERIAL PRIMARY KEY,
                case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
                client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
                contact_directly BOOLEAN DEFAULT TRUE,
                contact_via_id INTEGER REFERENCES contacts(id),
                contact_via_relationship VARCHAR(100),
                is_primary BOOLEAN DEFAULT FALSE,
                notes TEXT,
                UNIQUE(case_id, client_id)
            )
        """)

        # 5. Case_numbers table - REMOVED (now stored as JSONB in cases table)

        # 6. Case_contacts junction table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS case_contacts (
                id SERIAL PRIMARY KEY,
                case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
                contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
                role VARCHAR(50) NOT NULL,
                notes TEXT,
                UNIQUE(case_id, contact_id, role)
            )
        """)

        # 7. Defendants table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS defendants (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE
            )
        """)

        # 8. Case_defendants junction table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS case_defendants (
                id SERIAL PRIMARY KEY,
                case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
                defendant_id INTEGER REFERENCES defendants(id) ON DELETE CASCADE,
                UNIQUE(case_id, defendant_id)
            )
        """)

        # 9. Activities table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS activities (
                id SERIAL PRIMARY KEY,
                case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
                date DATE NOT NULL,
                description TEXT NOT NULL,
                type VARCHAR(50) NOT NULL,
                minutes INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 10. Deadlines table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS deadlines (
                id SERIAL PRIMARY KEY,
                case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
                date DATE NOT NULL,
                description TEXT NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'Pending',
                urgency INTEGER CHECK (urgency >= 1 AND urgency <= 5) DEFAULT 3,
                document_link TEXT,
                calculation_note TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 11. Tasks table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
                deadline_id INTEGER REFERENCES deadlines(id) ON DELETE SET NULL,
                due_date DATE,
                description TEXT NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'Pending',
                urgency INTEGER CHECK (urgency >= 1 AND urgency <= 5) DEFAULT 3,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 12. Notes table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS notes (
                id SERIAL PRIMARY KEY,
                case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

    print("Database tables initialized.")


def seed_db():
    """Insert sample data if tables are empty."""
    with get_cursor() as cur:
        cur.execute("SELECT COUNT(*) as count FROM cases")
        result = cur.fetchone()
        if result["count"] > 0:
            print("Database already seeded.")
            return

    # Sample data for personal injury practice
    with get_cursor() as cur:
        # Create sample case with case_numbers as JSONB
        import json
        case_numbers_json = json.dumps([{"number": "24STCV12345", "label": "State", "primary": True}])
        cur.execute("""
            INSERT INTO cases (case_name, status, court, case_summary, date_of_injury, case_numbers)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            "Martinez v. City of Los Angeles",
            "Discovery",
            "Superior Court of California, Los Angeles County",
            "Police excessive force case. Client injured during traffic stop.",
            "2024-06-15",
            case_numbers_json
        ))
        case_id = cur.fetchone()["id"]

        # Add client
        cur.execute("""
            INSERT INTO clients (name, phone, email)
            VALUES (%s, %s, %s)
            RETURNING id
        """, ("Maria Martinez", "555-123-4567", "mmartinez@email.com"))
        client_id = cur.fetchone()["id"]

        # Link client to case
        cur.execute("""
            INSERT INTO case_clients (case_id, client_id, contact_directly, is_primary)
            VALUES (%s, %s, %s, %s)
        """, (case_id, client_id, True, True))

        # Add defendant
        cur.execute("""
            INSERT INTO defendants (name)
            VALUES (%s)
            ON CONFLICT (name) DO NOTHING
            RETURNING id
        """, ("City of Los Angeles",))
        result = cur.fetchone()
        if result:
            defendant_id = result["id"]
            cur.execute("""
                INSERT INTO case_defendants (case_id, defendant_id)
                VALUES (%s, %s)
            """, (case_id, defendant_id))

        # Add contact (opposing counsel)
        cur.execute("""
            INSERT INTO contacts (name, firm, phone, email)
            VALUES (%s, %s, %s, %s)
            RETURNING id
        """, ("John Smith", "City Attorney's Office", "555-999-8888", "jsmith@lacity.gov"))
        contact_id = cur.fetchone()["id"]

        # Link contact to case
        cur.execute("""
            INSERT INTO case_contacts (case_id, contact_id, role)
            VALUES (%s, %s, %s)
        """, (case_id, contact_id, "Opposing Counsel"))

        # Add deadline
        cur.execute("""
            INSERT INTO deadlines (case_id, date, description, status, urgency, calculation_note)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (case_id, "2025-03-15", "Discovery cutoff", "Pending", 4, "Per Case Management Order"))
        deadline_id = cur.fetchone()["id"]

        # Add task linked to deadline
        cur.execute("""
            INSERT INTO tasks (case_id, deadline_id, due_date, description, status, urgency)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (case_id, deadline_id, "2025-03-01", "Complete deposition summaries", "Pending", 4))

        # Add activity
        cur.execute("""
            INSERT INTO activities (case_id, date, description, type, minutes)
            VALUES (%s, %s, %s, %s, %s)
        """, (case_id, "2024-12-01", "Reviewed police body cam footage", "Document Review", 180))

        # Add note
        cur.execute("""
            INSERT INTO notes (case_id, content)
            VALUES (%s, %s)
        """, (case_id, "Need to subpoena additional body cam footage from backup officers."))

    print("Database seeded with sample data.")


# ===== CASE OPERATIONS =====

DEFAULT_PAGE_SIZE = 50


def get_all_cases(status_filter: Optional[str] = None, limit: int = None,
                  offset: int = 0) -> dict:
    """Get cases with optional status filter and pagination."""
    with get_cursor() as cur:
        # Get total count
        if status_filter:
            cur.execute("SELECT COUNT(*) as count FROM cases WHERE status = %s", (status_filter,))
        else:
            cur.execute("SELECT COUNT(*) as count FROM cases")
        total = cur.fetchone()["count"]

        # Get paginated results
        query = """
            SELECT id, case_name, status, court, print_code
            FROM cases
        """
        params = []

        if status_filter:
            query += " WHERE status = %s"
            params.append(status_filter)

        query += " ORDER BY case_name"

        if limit is not None:
            query += " LIMIT %s OFFSET %s"
            params.extend([limit, offset])

        cur.execute(query, params)
        cases = [dict(row) for row in cur.fetchall()]

        return {"items": cases, "total": total, "limit": limit, "offset": offset}


def get_case_by_id(case_id: int) -> Optional[dict]:
    """Get full case details by ID."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT * FROM cases WHERE id = %s
        """, (case_id,))
        case = cur.fetchone()
        if not case:
            return None

        result = dict(case)

        # case_numbers is now JSONB in the cases table - parse it
        if result.get("case_numbers"):
            # Already a list from JSONB, ensure consistent format
            case_nums = result["case_numbers"]
            if isinstance(case_nums, str):
                import json
                case_nums = json.loads(case_nums)
            result["case_numbers"] = case_nums
        else:
            result["case_numbers"] = []

        # Get clients with contact info
        cur.execute("""
            SELECT cl.id, cl.name, cl.phone, cl.email,
                   cc.contact_directly, cc.is_primary,
                   cc.contact_via_relationship,
                   co.name as contact_via_name
            FROM clients cl
            JOIN case_clients cc ON cl.id = cc.client_id
            LEFT JOIN contacts co ON cc.contact_via_id = co.id
            WHERE cc.case_id = %s
        """, (case_id,))
        result["clients"] = [dict(row) for row in cur.fetchall()]

        # Get defendants
        cur.execute("""
            SELECT d.id, d.name
            FROM defendants d
            JOIN case_defendants cd ON d.id = cd.defendant_id
            WHERE cd.case_id = %s
        """, (case_id,))
        result["defendants"] = [dict(row) for row in cur.fetchall()]

        # Get contacts with roles
        cur.execute("""
            SELECT co.id, co.name, co.firm, co.phone, co.email, cc.role, cc.notes
            FROM contacts co
            JOIN case_contacts cc ON co.id = cc.contact_id
            WHERE cc.case_id = %s
        """, (case_id,))
        result["contacts"] = [dict(row) for row in cur.fetchall()]

        # Get activities
        cur.execute("""
            SELECT id, date, description, type, minutes
            FROM activities WHERE case_id = %s ORDER BY date DESC
        """, (case_id,))
        result["activities"] = [dict(row) for row in cur.fetchall()]

        # Get deadlines
        cur.execute("""
            SELECT id, date, description, status, urgency, document_link, calculation_note
            FROM deadlines WHERE case_id = %s ORDER BY date
        """, (case_id,))
        result["deadlines"] = [dict(row) for row in cur.fetchall()]

        # Get tasks
        cur.execute("""
            SELECT t.id, t.due_date, t.description, t.status, t.urgency, t.deadline_id,
                   d.description as deadline_description
            FROM tasks t
            LEFT JOIN deadlines d ON t.deadline_id = d.id
            WHERE t.case_id = %s ORDER BY t.due_date
        """, (case_id,))
        result["tasks"] = [dict(row) for row in cur.fetchall()]

        # Get notes
        cur.execute("""
            SELECT id, content, created_at
            FROM notes WHERE case_id = %s ORDER BY created_at DESC
        """, (case_id,))
        result["notes"] = [dict(row) for row in cur.fetchall()]

        # Convert dates to strings
        for key in ["date_of_injury", "claim_due", "claim_filed_date",
                    "complaint_due", "complaint_filed_date", "trial_date",
                    "created_at", "updated_at"]:
            if result.get(key):
                result[key] = str(result[key])

        for item in result["activities"]:
            if item.get("date"):
                item["date"] = str(item["date"])
        for item in result["deadlines"]:
            if item.get("date"):
                item["date"] = str(item["date"])
        for item in result["tasks"]:
            if item.get("due_date"):
                item["due_date"] = str(item["due_date"])
        for item in result["notes"]:
            if item.get("created_at"):
                item["created_at"] = str(item["created_at"])

        return result


def get_case_by_name(case_name: str) -> Optional[dict]:
    """Get case by name (for backwards compatibility)."""
    with get_cursor() as cur:
        cur.execute("SELECT id FROM cases WHERE case_name = %s", (case_name,))
        case = cur.fetchone()
        if not case:
            return None
        return get_case_by_id(case["id"])


def create_case(case_name: str, status: str = "Signing Up", court: str = None,
                print_code: str = None, case_summary: str = None,
                date_of_injury: str = None, case_numbers: List[dict] = None,
                clients: List[dict] = None, defendants: List[str] = None,
                contacts: List[dict] = None) -> dict:
    """
    Create a new case with optional nested data.

    Args:
        case_name: Name of the case
        status: Case status
        court: Court name
        print_code: Short code for printing
        case_summary: Brief description
        date_of_injury: Date of injury (YYYY-MM-DD)
        case_numbers: List of case numbers [{"number": "...", "label": "...", "primary": bool}]
        clients: List of clients to add [{"name": "...", "phone": "...", "is_primary": bool, ...}]
        defendants: List of defendant names ["City of LA", "LAPD"]
        contacts: List of contacts to add [{"name": "...", "role": "...", "firm": "..."}]

    Returns the created case with nested data summary.
    """
    import json
    case_numbers_json = json.dumps(case_numbers) if case_numbers else '[]'

    with get_cursor() as cur:
        # Create the case
        cur.execute("""
            INSERT INTO cases (case_name, status, court, print_code, case_summary, date_of_injury, case_numbers)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (case_name, status, court, print_code, case_summary, date_of_injury, case_numbers_json))
        case_id = cur.fetchone()["id"]

    # Add clients (using smart function - outside the cursor context for separate transactions)
    clients_added = []
    if clients:
        for client_data in clients:
            result = smart_add_client_to_case(
                case_id=case_id,
                name=client_data.get("name"),
                phone=client_data.get("phone"),
                email=client_data.get("email"),
                address=client_data.get("address"),
                contact_directly=client_data.get("contact_directly", True),
                contact_via=client_data.get("contact_via"),
                contact_via_relationship=client_data.get("contact_via_relationship"),
                is_primary=client_data.get("is_primary", False),
                notes=client_data.get("notes")
            )
            clients_added.append({"name": client_data.get("name"), "client_id": result.get("client_id")})

    # Add defendants
    defendants_added = []
    if defendants:
        for defendant_name in defendants:
            add_defendant_to_case(case_id, defendant_name)
            defendants_added.append(defendant_name)

    # Add contacts (using smart function)
    contacts_added = []
    if contacts:
        for contact_data in contacts:
            result = smart_add_contact_to_case(
                case_id=case_id,
                name=contact_data.get("name"),
                role=contact_data.get("role"),
                firm=contact_data.get("firm"),
                phone=contact_data.get("phone"),
                email=contact_data.get("email"),
                notes=contact_data.get("notes")
            )
            contacts_added.append({
                "name": contact_data.get("name"),
                "role": contact_data.get("role"),
                "contact_id": result.get("contact_id")
            })

    return {
        "id": case_id,
        "case_name": case_name,
        "status": status,
        "case_numbers": case_numbers or [],
        "clients_added": clients_added,
        "defendants_added": defendants_added,
        "contacts_added": contacts_added
    }


def update_case(case_id: int, **kwargs) -> Optional[dict]:
    """Update case fields, including case_numbers as JSONB."""
    import json

    allowed_fields = ["case_name", "status", "court", "print_code", "case_summary",
                      "date_of_injury", "claim_due", "claim_filed_date",
                      "complaint_due", "complaint_filed_date", "trial_date", "case_numbers"]
    updates = {k: v for k, v in kwargs.items() if k in allowed_fields and v is not None}

    if not updates:
        return None

    # Convert case_numbers list to JSON string for storage
    if "case_numbers" in updates:
        updates["case_numbers"] = json.dumps(updates["case_numbers"])

    set_clause = ", ".join(f"{k} = %s" for k in updates.keys())
    values = list(updates.values()) + [case_id]

    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE cases SET {set_clause}, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING id, case_name, status, case_numbers
        """, values)
        result = cur.fetchone()
        if result:
            r = dict(result)
            # Parse case_numbers back to list
            if r.get("case_numbers"):
                if isinstance(r["case_numbers"], str):
                    r["case_numbers"] = json.loads(r["case_numbers"])
            else:
                r["case_numbers"] = []
            return r
        return None


def get_all_case_names() -> List[str]:
    """Get list of all case names."""
    with get_cursor() as cur:
        cur.execute("SELECT case_name FROM cases ORDER BY case_name")
        return [row["case_name"] for row in cur.fetchall()]


# ===== CLIENT OPERATIONS =====

def create_client(name: str, phone: str = None, email: str = None,
                  address: str = None, notes: str = None) -> dict:
    """Create a new client."""
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO clients (name, phone, email, address, notes)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, name
        """, (name, phone, email, address, notes))
        return dict(cur.fetchone())


def add_client_to_case(case_id: int, client_id: int, contact_directly: bool = True,
                       contact_via_id: int = None, contact_via_relationship: str = None,
                       is_primary: bool = False, notes: str = None) -> dict:
    """Link a client to a case with contact preferences."""
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO case_clients (case_id, client_id, contact_directly,
                                      contact_via_id, contact_via_relationship, is_primary, notes)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (case_id, client_id) DO UPDATE SET
                contact_directly = EXCLUDED.contact_directly,
                contact_via_id = EXCLUDED.contact_via_id,
                contact_via_relationship = EXCLUDED.contact_via_relationship,
                is_primary = EXCLUDED.is_primary,
                notes = EXCLUDED.notes
            RETURNING id
        """, (case_id, client_id, contact_directly, contact_via_id,
              contact_via_relationship, is_primary, notes))
        return {"success": True, "id": cur.fetchone()["id"]}


# ===== CASE NUMBER OPERATIONS =====
# NOTE: Case numbers are now stored as JSONB in the cases table.
# Use update_case(case_id, case_numbers=[...]) to modify case numbers.


# ===== SMART ENTITY OPERATIONS =====
# These functions handle find-or-create logic internally, reducing the number of
# tool calls Claude needs to make.

def smart_add_client_to_case(case_id: int, name: str, phone: str = None,
                              email: str = None, address: str = None,
                              contact_directly: bool = True,
                              contact_via: str = None,
                              contact_via_relationship: str = None,
                              is_primary: bool = False, notes: str = None) -> dict:
    """
    Smart client add - finds existing client or creates new, then links to case.

    Search priority:
    1. Exact name match with matching phone or email
    2. Exact name match
    3. Create new client
    """
    with get_cursor() as cur:
        client_id = None
        client_name = None
        created_new = False

        # Try to find existing client
        if phone or email:
            # First try exact name + phone/email match
            conditions = ["name ILIKE %s"]
            params = [name]

            if phone:
                conditions.append("phone = %s")
                params.append(phone)
            if email:
                conditions.append("email ILIKE %s")
                params.append(email)

            where = " AND ".join(conditions)
            cur.execute(f"SELECT id, name FROM clients WHERE {where} LIMIT 1", params)
            result = cur.fetchone()
            if result:
                client_id = result["id"]
                client_name = result["name"]

        if not client_id:
            # Try exact name match only
            cur.execute("SELECT id, name FROM clients WHERE name ILIKE %s LIMIT 1", (name,))
            result = cur.fetchone()
            if result:
                client_id = result["id"]
                client_name = result["name"]

        if not client_id:
            # Create new client
            cur.execute("""
                INSERT INTO clients (name, phone, email, address, notes)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id, name
            """, (name, phone, email, address, notes))
            result = cur.fetchone()
            client_id = result["id"]
            client_name = result["name"]
            created_new = True

        # Handle contact_via (find or create the contact person)
        contact_via_id = None
        if not contact_directly and contact_via:
            cur.execute("SELECT id FROM contacts WHERE name ILIKE %s LIMIT 1", (contact_via,))
            result = cur.fetchone()
            if result:
                contact_via_id = result["id"]
            else:
                # Create the contact person
                cur.execute("""
                    INSERT INTO contacts (name)
                    VALUES (%s)
                    RETURNING id
                """, (contact_via,))
                contact_via_id = cur.fetchone()["id"]

        # Link client to case (upsert)
        cur.execute("""
            INSERT INTO case_clients (case_id, client_id, contact_directly,
                                      contact_via_id, contact_via_relationship, is_primary, notes)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (case_id, client_id) DO UPDATE SET
                contact_directly = EXCLUDED.contact_directly,
                contact_via_id = EXCLUDED.contact_via_id,
                contact_via_relationship = EXCLUDED.contact_via_relationship,
                is_primary = EXCLUDED.is_primary,
                notes = EXCLUDED.notes
            RETURNING id
        """, (case_id, client_id, contact_directly, contact_via_id,
              contact_via_relationship, is_primary, notes))

        return {
            "success": True,
            "client_id": client_id,
            "client_name": client_name,
            "created_new": created_new,
            "contact_method": "direct" if contact_directly else f"via {contact_via} ({contact_via_relationship})"
        }


def smart_add_contact_to_case(case_id: int, name: str, role: str,
                               firm: str = None, phone: str = None,
                               email: str = None, notes: str = None) -> dict:
    """
    Smart contact add - finds existing contact or creates new, then links to case with role.

    Search priority:
    1. Exact name match with matching firm
    2. Exact name match
    3. Create new contact
    """
    with get_cursor() as cur:
        contact_id = None
        contact_name = None
        created_new = False

        # Try to find existing contact
        if firm:
            # First try name + firm match
            cur.execute("""
                SELECT id, name, firm FROM contacts
                WHERE name ILIKE %s AND firm ILIKE %s
                LIMIT 1
            """, (name, firm))
            result = cur.fetchone()
            if result:
                contact_id = result["id"]
                contact_name = result["name"]

        if not contact_id:
            # Try exact name match only
            cur.execute("SELECT id, name, firm FROM contacts WHERE name ILIKE %s LIMIT 1", (name,))
            result = cur.fetchone()
            if result:
                contact_id = result["id"]
                contact_name = result["name"]

        if not contact_id:
            # Create new contact
            cur.execute("""
                INSERT INTO contacts (name, firm, phone, email, notes)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id, name
            """, (name, firm, phone, email, notes))
            result = cur.fetchone()
            contact_id = result["id"]
            contact_name = result["name"]
            created_new = True

        # Link contact to case with role (upsert)
        cur.execute("""
            INSERT INTO case_contacts (case_id, contact_id, role, notes)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (case_id, contact_id, role) DO UPDATE SET notes = EXCLUDED.notes
            RETURNING id
        """, (case_id, contact_id, role, notes))

        return {
            "success": True,
            "contact_id": contact_id,
            "contact_name": contact_name,
            "role": role,
            "created_new": created_new
        }


def remove_client_from_case_by_name(case_id: int, client_name: str) -> dict:
    """Remove a client from a case by name (does not delete the client record)."""
    with get_cursor() as cur:
        # Find client by name
        cur.execute("""
            SELECT cl.id, cl.name
            FROM clients cl
            JOIN case_clients cc ON cl.id = cc.client_id
            WHERE cc.case_id = %s AND cl.name ILIKE %s
        """, (case_id, f"%{client_name}%"))
        result = cur.fetchone()

        if not result:
            return {"success": False, "error": f"Client '{client_name}' not found on this case"}

        client_id = result["id"]
        actual_name = result["name"]

        cur.execute("""
            DELETE FROM case_clients WHERE case_id = %s AND client_id = %s
            RETURNING id
        """, (case_id, client_id))

        if cur.fetchone():
            return {"success": True, "message": f"Client '{actual_name}' removed from case"}
        return {"success": False, "error": "Failed to remove client"}


def remove_contact_from_case_by_name(case_id: int, contact_name: str, role: str = None) -> dict:
    """Remove a contact from a case by name. If role specified, only removes that role."""
    with get_cursor() as cur:
        # Find contact by name
        if role:
            cur.execute("""
                SELECT co.id, co.name, cc.role
                FROM contacts co
                JOIN case_contacts cc ON co.id = cc.contact_id
                WHERE cc.case_id = %s AND co.name ILIKE %s AND cc.role = %s
            """, (case_id, f"%{contact_name}%", role))
        else:
            cur.execute("""
                SELECT co.id, co.name, cc.role
                FROM contacts co
                JOIN case_contacts cc ON co.id = cc.contact_id
                WHERE cc.case_id = %s AND co.name ILIKE %s
            """, (case_id, f"%{contact_name}%"))

        result = cur.fetchone()

        if not result:
            return {"success": False, "error": f"Contact '{contact_name}' not found on this case" + (f" with role '{role}'" if role else "")}

        contact_id = result["id"]
        actual_name = result["name"]
        actual_role = result["role"]

        if role:
            cur.execute("""
                DELETE FROM case_contacts
                WHERE case_id = %s AND contact_id = %s AND role = %s
                RETURNING id
            """, (case_id, contact_id, role))
        else:
            cur.execute("""
                DELETE FROM case_contacts
                WHERE case_id = %s AND contact_id = %s
                RETURNING id
            """, (case_id, contact_id))

        if cur.fetchone():
            return {"success": True, "message": f"Contact '{actual_name}' ({actual_role}) removed from case"}
        return {"success": False, "error": "Failed to remove contact"}


def remove_defendant_from_case_by_name(case_id: int, defendant_name: str) -> dict:
    """Remove a defendant from a case by name."""
    with get_cursor() as cur:
        # Find defendant by name
        cur.execute("""
            SELECT d.id, d.name
            FROM defendants d
            JOIN case_defendants cd ON d.id = cd.defendant_id
            WHERE cd.case_id = %s AND d.name ILIKE %s
        """, (case_id, f"%{defendant_name}%"))
        result = cur.fetchone()

        if not result:
            return {"success": False, "error": f"Defendant '{defendant_name}' not found on this case"}

        defendant_id = result["id"]
        actual_name = result["name"]

        cur.execute("""
            DELETE FROM case_defendants WHERE case_id = %s AND defendant_id = %s
            RETURNING id
        """, (case_id, defendant_id))

        if cur.fetchone():
            return {"success": True, "message": f"Defendant '{actual_name}' removed from case"}
        return {"success": False, "error": "Failed to remove defendant"}


# ===== CONTACT OPERATIONS =====

def create_contact(name: str, firm: str = None, phone: str = None,
                   email: str = None, address: str = None, notes: str = None) -> dict:
    """Create a new contact."""
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO contacts (name, firm, phone, email, address, notes)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, name, firm
        """, (name, firm, phone, email, address, notes))
        return dict(cur.fetchone())


def link_contact_to_case(case_id: int, contact_id: int, role: str, notes: str = None) -> dict:
    """Link a contact to a case with a specific role."""
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO case_contacts (case_id, contact_id, role, notes)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (case_id, contact_id, role) DO UPDATE SET notes = EXCLUDED.notes
            RETURNING id
        """, (case_id, contact_id, role, notes))
        return {"success": True, "id": cur.fetchone()["id"], "role": role}


def get_contact_by_name(name: str) -> Optional[dict]:
    """Find a contact by name."""
    with get_cursor() as cur:
        cur.execute("SELECT * FROM contacts WHERE name ILIKE %s", (f"%{name}%",))
        result = cur.fetchone()
        return dict(result) if result else None


# ===== DEFENDANT OPERATIONS =====

def add_defendant_to_case(case_id: int, defendant_name: str) -> dict:
    """Add a defendant to a case (creates defendant if not exists)."""
    with get_cursor() as cur:
        # Get or create defendant
        cur.execute("""
            INSERT INTO defendants (name) VALUES (%s)
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
        """, (defendant_name,))
        defendant_id = cur.fetchone()["id"]

        # Link to case
        cur.execute("""
            INSERT INTO case_defendants (case_id, defendant_id)
            VALUES (%s, %s)
            ON CONFLICT (case_id, defendant_id) DO NOTHING
            RETURNING id
        """, (case_id, defendant_id))

        return {"success": True, "defendant_name": defendant_name}


def search_cases_by_defendant(defendant_name: str) -> List[dict]:
    """Find all cases involving a defendant."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT c.id, c.case_name, c.status, d.name as defendant_name
            FROM cases c
            JOIN case_defendants cd ON c.id = cd.case_id
            JOIN defendants d ON cd.defendant_id = d.id
            WHERE d.name ILIKE %s
            ORDER BY c.case_name
        """, (f"%{defendant_name}%",))
        return [dict(row) for row in cur.fetchall()]


# ===== SEARCH OPERATIONS =====

def search_clients(name: str = None, phone: str = None, email: str = None) -> List[dict]:
    """
    Search for clients by name, phone, or email.
    Returns clients with their case associations for disambiguation.
    """
    with get_cursor() as cur:
        # Build WHERE clause based on provided filters
        conditions = []
        params = []

        if name:
            conditions.append("cl.name ILIKE %s")
            params.append(f"%{name}%")
        if phone:
            conditions.append("cl.phone ILIKE %s")
            params.append(f"%{phone}%")
        if email:
            conditions.append("cl.email ILIKE %s")
            params.append(f"%{email}%")

        if not conditions:
            return []

        where_clause = " OR ".join(conditions)

        # Get matching clients
        cur.execute(f"""
            SELECT DISTINCT cl.id, cl.name, cl.phone, cl.email, cl.address
            FROM clients cl
            WHERE {where_clause}
            ORDER BY cl.name
        """, params)

        clients = [dict(row) for row in cur.fetchall()]

        # For each client, get their case associations
        for client in clients:
            cur.execute("""
                SELECT c.id, c.case_name, c.status, cc.is_primary
                FROM cases c
                JOIN case_clients cc ON c.id = cc.case_id
                WHERE cc.client_id = %s
                ORDER BY c.case_name
            """, (client["id"],))
            client["cases"] = [dict(row) for row in cur.fetchall()]

        return clients


def search_cases(query: str = None, case_number: str = None, defendant: str = None,
                 client: str = None, contact: str = None, status: str = None) -> List[dict]:
    """
    Search for cases with multiple filter options.
    Returns cases with clients and defendants for context.

    Args:
        query: Free text search on case name
        case_number: Search by case number (partial match)
        defendant: Filter by defendant name (partial match)
        client: Filter by client/plaintiff name (partial match)
        contact: Filter by contact name (partial match)
        status: Filter by exact status match

    All filters are AND conditions (case must match all provided filters).
    """
    with get_cursor() as cur:
        # Build query with JOINs for filtering
        joins = []
        conditions = []
        params = []

        if query:
            conditions.append("c.case_name ILIKE %s")
            params.append(f"%{query}%")

        if case_number:
            # Search within JSONB array for matching case numbers
            conditions.append("EXISTS (SELECT 1 FROM jsonb_array_elements(c.case_numbers) elem WHERE elem->>'number' ILIKE %s)")
            params.append(f"%{case_number}%")

        if defendant:
            joins.append("JOIN case_defendants cd_filter ON c.id = cd_filter.case_id")
            joins.append("JOIN defendants d_filter ON cd_filter.defendant_id = d_filter.id")
            conditions.append("d_filter.name ILIKE %s")
            params.append(f"%{defendant}%")

        if client:
            joins.append("JOIN case_clients cc_filter ON c.id = cc_filter.case_id")
            joins.append("JOIN clients cl_filter ON cc_filter.client_id = cl_filter.id")
            conditions.append("cl_filter.name ILIKE %s")
            params.append(f"%{client}%")

        if contact:
            joins.append("JOIN case_contacts cco_filter ON c.id = cco_filter.case_id")
            joins.append("JOIN contacts co_filter ON cco_filter.contact_id = co_filter.id")
            conditions.append("co_filter.name ILIKE %s")
            params.append(f"%{contact}%")

        if status:
            conditions.append("c.status = %s")
            params.append(status)

        # If no filters provided, return empty (or could return all)
        if not conditions:
            return []

        join_clause = " ".join(joins)
        where_clause = " AND ".join(conditions)

        # Get matching cases
        cur.execute(f"""
            SELECT DISTINCT c.id, c.case_name, c.status, c.court, c.trial_date, c.case_numbers
            FROM cases c
            {join_clause}
            WHERE {where_clause}
            ORDER BY c.case_name
        """, params)

        cases = [dict(row) for row in cur.fetchall()]

        # For each case, get clients, defendants, and parse case_numbers
        for case in cases:
            if case.get("trial_date"):
                case["trial_date"] = str(case["trial_date"])

            # Parse case_numbers from JSONB
            if case.get("case_numbers"):
                if isinstance(case["case_numbers"], str):
                    import json
                    case["case_numbers"] = json.loads(case["case_numbers"])
            else:
                case["case_numbers"] = []

            # Get clients
            cur.execute("""
                SELECT cl.id, cl.name
                FROM clients cl
                JOIN case_clients cc ON cl.id = cc.client_id
                WHERE cc.case_id = %s
            """, (case["id"],))
            case["clients"] = [dict(row) for row in cur.fetchall()]

            # Get defendants
            cur.execute("""
                SELECT d.id, d.name
                FROM defendants d
                JOIN case_defendants cd ON d.id = cd.defendant_id
                WHERE cd.case_id = %s
            """, (case["id"],))
            case["defendants"] = [dict(row) for row in cur.fetchall()]

            # Get contacts
            cur.execute("""
                SELECT co.id, co.name, cc.role
                FROM contacts co
                JOIN case_contacts cc ON co.id = cc.contact_id
                WHERE cc.case_id = %s
            """, (case["id"],))
            case["contacts"] = [dict(row) for row in cur.fetchall()]

        return cases


def search_contacts(name: str = None, firm: str = None, role: str = None) -> List[dict]:
    """
    Search for contacts by name, firm, or role.
    Returns contacts with their case/role associations for disambiguation.
    """
    with get_cursor() as cur:
        # Build query with optional role filter (requires JOIN)
        joins = []
        conditions = []
        params = []

        if name:
            conditions.append("co.name ILIKE %s")
            params.append(f"%{name}%")
        if firm:
            conditions.append("co.firm ILIKE %s")
            params.append(f"%{firm}%")
        if role:
            joins.append("JOIN case_contacts cc_filter ON co.id = cc_filter.contact_id")
            conditions.append("cc_filter.role = %s")
            params.append(role)

        if not conditions:
            return []

        join_clause = " ".join(joins)
        where_clause = " AND ".join(conditions)

        # Get matching contacts
        cur.execute(f"""
            SELECT DISTINCT co.id, co.name, co.firm, co.phone, co.email
            FROM contacts co
            {join_clause}
            WHERE {where_clause}
            ORDER BY co.name
        """, params)

        contacts = [dict(row) for row in cur.fetchall()]

        # For each contact, get their case/role associations
        for contact in contacts:
            cur.execute("""
                SELECT c.id, c.case_name, cc.role
                FROM cases c
                JOIN case_contacts cc ON c.id = cc.case_id
                WHERE cc.contact_id = %s
                ORDER BY c.case_name
            """, (contact["id"],))
            contact["cases"] = [dict(row) for row in cur.fetchall()]

        return contacts


def search_tasks(query: str = None, case_id: int = None, status: str = None,
                 urgency_min: int = None) -> List[dict]:
    """
    Search for tasks by description, case, status, or urgency.
    """
    with get_cursor() as cur:
        conditions = ["1=1"]
        params = []

        if query:
            conditions.append("t.description ILIKE %s")
            params.append(f"%{query}%")
        if case_id:
            conditions.append("t.case_id = %s")
            params.append(case_id)
        if status:
            conditions.append("t.status = %s")
            params.append(status)
        if urgency_min:
            conditions.append("t.urgency >= %s")
            params.append(urgency_min)

        where_clause = " AND ".join(conditions)

        cur.execute(f"""
            SELECT t.id, t.description, t.status, t.urgency, t.due_date,
                   c.id as case_id, c.case_name
            FROM tasks t
            JOIN cases c ON t.case_id = c.id
            WHERE {where_clause}
            ORDER BY t.due_date NULLS LAST, t.urgency DESC
        """, params)

        results = []
        for row in cur.fetchall():
            r = dict(row)
            if r.get("due_date"):
                r["due_date"] = str(r["due_date"])
            results.append(r)

        return results


def search_deadlines(query: str = None, case_id: int = None, status: str = None,
                     urgency_min: int = None) -> List[dict]:
    """
    Search for deadlines by description, case, status, or urgency.
    """
    with get_cursor() as cur:
        conditions = ["1=1"]
        params = []

        if query:
            conditions.append("d.description ILIKE %s")
            params.append(f"%{query}%")
        if case_id:
            conditions.append("d.case_id = %s")
            params.append(case_id)
        if status:
            conditions.append("d.status = %s")
            params.append(status)
        if urgency_min:
            conditions.append("d.urgency >= %s")
            params.append(urgency_min)

        where_clause = " AND ".join(conditions)

        cur.execute(f"""
            SELECT d.id, d.description, d.status, d.urgency, d.date,
                   d.calculation_note, c.id as case_id, c.case_name
            FROM deadlines d
            JOIN cases c ON d.case_id = c.id
            WHERE {where_clause}
            ORDER BY d.date, d.urgency DESC
        """, params)

        results = []
        for row in cur.fetchall():
            r = dict(row)
            if r.get("date"):
                r["date"] = str(r["date"])
            results.append(r)

        return results


# ===== ACTIVITY OPERATIONS =====

def add_activity(case_id: int, description: str, activity_type: str,
                 date: str = None, minutes: int = None) -> dict:
    """Add an activity to a case."""
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO activities (case_id, date, description, type, minutes)
            VALUES (%s, COALESCE(%s, CURRENT_DATE), %s, %s, %s)
            RETURNING id, date, description, type, minutes
        """, (case_id, date, description, activity_type, minutes))
        result = dict(cur.fetchone())
        result["date"] = str(result["date"])
        return result


# ===== DEADLINE OPERATIONS =====

def add_deadline(case_id: int, date: str, description: str, status: str = "Pending",
                 urgency: int = 3, document_link: str = None,
                 calculation_note: str = None) -> dict:
    """Add a deadline to a case."""
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO deadlines (case_id, date, description, status, urgency,
                                   document_link, calculation_note)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id, date, description, status, urgency
        """, (case_id, date, description, status, urgency, document_link, calculation_note))
        result = dict(cur.fetchone())
        result["date"] = str(result["date"])
        return result


def get_upcoming_deadlines(urgency_filter: int = None, status_filter: str = None,
                           due_within_days: int = None, case_id: int = None,
                           limit: int = None, offset: int = 0) -> dict:
    """Get deadlines with optional filters and pagination."""
    with get_cursor() as cur:
        # Build WHERE clause
        where_parts = ["1=1"]
        params = []

        if case_id:
            where_parts.append("d.case_id = %s")
            params.append(case_id)
        if urgency_filter:
            where_parts.append("d.urgency >= %s")
            params.append(urgency_filter)
        if status_filter:
            where_parts.append("d.status = %s")
            params.append(status_filter)
        if due_within_days is not None:
            where_parts.append("d.date <= CURRENT_DATE + INTERVAL '%s days'")
            params.append(due_within_days)
            where_parts.append("d.date >= CURRENT_DATE")  # Only future/today

        where_clause = " AND ".join(where_parts)

        # Get total count
        cur.execute(f"SELECT COUNT(*) as count FROM deadlines d WHERE {where_clause}", params)
        total = cur.fetchone()["count"]

        # Get paginated results
        query = f"""
            SELECT d.id, d.date, d.description, d.status, d.urgency,
                   d.document_link, d.calculation_note,
                   c.id as case_id, c.case_name
            FROM deadlines d
            JOIN cases c ON d.case_id = c.id
            WHERE {where_clause}
            ORDER BY d.date
        """

        if limit is not None:
            query += " LIMIT %s OFFSET %s"
            params.extend([limit, offset])

        cur.execute(query, params)
        results = []
        for row in cur.fetchall():
            r = dict(row)
            r["date"] = str(r["date"])
            results.append(r)

        return {"items": results, "total": total, "limit": limit, "offset": offset}


def get_calendar(days: int = 30, include_tasks: bool = True,
                 include_deadlines: bool = True, case_id: int = None) -> dict:
    """
    Get a combined calendar view of tasks and deadlines.

    Args:
        days: Number of days to look ahead (default 30)
        include_tasks: Include tasks in results (default True)
        include_deadlines: Include deadlines in results (default True)
        case_id: Optional filter to specific case

    Returns combined, sorted list with type indicator.
    """
    items = []

    with get_cursor() as cur:
        if include_deadlines:
            # Get deadlines
            query = """
                SELECT d.id, d.date, d.description, d.status, d.urgency,
                       c.id as case_id, c.case_name,
                       'deadline' as item_type
                FROM deadlines d
                JOIN cases c ON d.case_id = c.id
                WHERE d.date >= CURRENT_DATE
                  AND d.date <= CURRENT_DATE + INTERVAL '%s days'
                  AND d.status = 'Pending'
            """
            params = [days]

            if case_id:
                query += " AND d.case_id = %s"
                params.append(case_id)

            query += " ORDER BY d.date"
            cur.execute(query, params)

            for row in cur.fetchall():
                r = dict(row)
                r["date"] = str(r["date"])
                items.append(r)

        if include_tasks:
            # Get tasks with due dates
            query = """
                SELECT t.id, t.due_date as date, t.description, t.status, t.urgency,
                       c.id as case_id, c.case_name,
                       'task' as item_type
                FROM tasks t
                JOIN cases c ON t.case_id = c.id
                WHERE t.due_date IS NOT NULL
                  AND t.due_date >= CURRENT_DATE
                  AND t.due_date <= CURRENT_DATE + INTERVAL '%s days'
                  AND t.status NOT IN ('Done')
            """
            params = [days]

            if case_id:
                query += " AND t.case_id = %s"
                params.append(case_id)

            query += " ORDER BY t.due_date"
            cur.execute(query, params)

            for row in cur.fetchall():
                r = dict(row)
                r["date"] = str(r["date"])
                items.append(r)

    # Sort combined results by date
    items.sort(key=lambda x: x["date"])

    # Group by date for easier display
    from collections import defaultdict
    by_date = defaultdict(list)
    for item in items:
        by_date[item["date"]].append(item)

    return {
        "items": items,
        "total": len(items),
        "days": days,
        "by_date": dict(by_date)
    }


def update_deadline(deadline_id: int, status: str = None, urgency: int = None) -> Optional[dict]:
    """Update a deadline's status or urgency."""
    updates = {}
    if status:
        updates["status"] = status
    if urgency:
        updates["urgency"] = urgency

    if not updates:
        return None

    set_clause = ", ".join(f"{k} = %s" for k in updates.keys())
    values = list(updates.values()) + [deadline_id]

    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE deadlines SET {set_clause}
            WHERE id = %s
            RETURNING id, date, description, status, urgency
        """, values)
        result = cur.fetchone()
        if result:
            r = dict(result)
            r["date"] = str(r["date"])
            return r
        return None


# ===== TASK OPERATIONS =====

def add_task(case_id: int, description: str, due_date: str = None,
             status: str = "Pending", urgency: int = 3,
             deadline_id: int = None) -> dict:
    """Add a task to a case, optionally linked to a deadline."""
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO tasks (case_id, deadline_id, due_date, description, status, urgency)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, due_date, description, status, urgency, deadline_id
        """, (case_id, deadline_id, due_date, description, status, urgency))
        result = dict(cur.fetchone())
        if result.get("due_date"):
            result["due_date"] = str(result["due_date"])
        return result


def get_tasks(case_id: int = None, status_filter: str = None,
              urgency_filter: int = None, due_within_days: int = None,
              limit: int = None, offset: int = 0) -> dict:
    """Get tasks with optional filters and pagination."""
    with get_cursor() as cur:
        # Build WHERE clause
        where_parts = ["1=1"]
        params = []

        if case_id:
            where_parts.append("t.case_id = %s")
            params.append(case_id)
        if status_filter:
            where_parts.append("t.status = %s")
            params.append(status_filter)
        if urgency_filter:
            where_parts.append("t.urgency >= %s")
            params.append(urgency_filter)
        if due_within_days is not None:
            where_parts.append("t.due_date <= CURRENT_DATE + INTERVAL '%s days'")
            params.append(due_within_days)
            where_parts.append("t.due_date >= CURRENT_DATE")  # Only future/today

        where_clause = " AND ".join(where_parts)

        # Get total count
        cur.execute(f"SELECT COUNT(*) as count FROM tasks t WHERE {where_clause}", params)
        total = cur.fetchone()["count"]

        # Get paginated results
        query = f"""
            SELECT t.id, t.due_date, t.description, t.status, t.urgency,
                   t.deadline_id, c.id as case_id, c.case_name,
                   d.description as deadline_description, d.date as deadline_date
            FROM tasks t
            JOIN cases c ON t.case_id = c.id
            LEFT JOIN deadlines d ON t.deadline_id = d.id
            WHERE {where_clause}
            ORDER BY t.due_date NULLS LAST
        """

        if limit is not None:
            query += " LIMIT %s OFFSET %s"
            params.extend([limit, offset])

        cur.execute(query, params)
        results = []
        for row in cur.fetchall():
            r = dict(row)
            if r.get("due_date"):
                r["due_date"] = str(r["due_date"])
            if r.get("deadline_date"):
                r["deadline_date"] = str(r["deadline_date"])
            results.append(r)

        return {"items": results, "total": total, "limit": limit, "offset": offset}


def update_task(task_id: int, status: str = None, urgency: int = None,
                due_date: str = None) -> Optional[dict]:
    """Update a task's status, urgency, or due date."""
    updates = {}
    if status:
        updates["status"] = status
    if urgency:
        updates["urgency"] = urgency
    if due_date:
        updates["due_date"] = due_date

    if not updates:
        return None

    set_clause = ", ".join(f"{k} = %s" for k in updates.keys())
    values = list(updates.values()) + [task_id]

    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE tasks SET {set_clause}
            WHERE id = %s
            RETURNING id, due_date, description, status, urgency
        """, values)
        result = cur.fetchone()
        if result:
            r = dict(result)
            if r.get("due_date"):
                r["due_date"] = str(r["due_date"])
            return r
        return None


def bulk_update_tasks(task_ids: List[int], status: str) -> dict:
    """Update multiple tasks to the same status."""
    if not task_ids:
        return {"success": False, "error": "No task IDs provided", "updated": 0}

    with get_cursor() as cur:
        # Use ANY to match multiple IDs
        cur.execute("""
            UPDATE tasks SET status = %s
            WHERE id = ANY(%s)
            RETURNING id, description, status
        """, (status, task_ids))
        updated = [dict(row) for row in cur.fetchall()]

    return {
        "success": True,
        "updated": len(updated),
        "tasks": updated
    }


def bulk_update_deadlines(deadline_ids: List[int], status: str) -> dict:
    """Update multiple deadlines to the same status."""
    if not deadline_ids:
        return {"success": False, "error": "No deadline IDs provided", "updated": 0}

    with get_cursor() as cur:
        cur.execute("""
            UPDATE deadlines SET status = %s
            WHERE id = ANY(%s)
            RETURNING id, description, status
        """, (status, deadline_ids))
        updated = [dict(row) for row in cur.fetchall()]

    return {
        "success": True,
        "updated": len(updated),
        "deadlines": updated
    }


def bulk_update_tasks_for_case(case_id: int, status: str, current_status: str = None) -> dict:
    """Update all tasks for a case to a new status, optionally filtering by current status."""
    with get_cursor() as cur:
        if current_status:
            cur.execute("""
                UPDATE tasks SET status = %s
                WHERE case_id = %s AND status = %s
                RETURNING id, description, status
            """, (status, case_id, current_status))
        else:
            cur.execute("""
                UPDATE tasks SET status = %s
                WHERE case_id = %s
                RETURNING id, description, status
            """, (status, case_id))
        updated = [dict(row) for row in cur.fetchall()]

    return {
        "success": True,
        "updated": len(updated),
        "tasks": updated
    }


# ===== NOTE OPERATIONS =====

def add_note(case_id: int, content: str) -> dict:
    """Add a note to a case."""
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO notes (case_id, content)
            VALUES (%s, %s)
            RETURNING id, content, created_at
        """, (case_id, content))
        result = dict(cur.fetchone())
        result["created_at"] = str(result["created_at"])
        return result


# ===== DELETE OPERATIONS =====

def delete_task(task_id: int) -> bool:
    """Delete a task by ID."""
    with get_cursor() as cur:
        cur.execute("DELETE FROM tasks WHERE id = %s RETURNING id", (task_id,))
        return cur.fetchone() is not None


def delete_deadline(deadline_id: int) -> bool:
    """Delete a deadline by ID."""
    with get_cursor() as cur:
        cur.execute("DELETE FROM deadlines WHERE id = %s RETURNING id", (deadline_id,))
        return cur.fetchone() is not None


def delete_note(note_id: int) -> bool:
    """Delete a note by ID."""
    with get_cursor() as cur:
        cur.execute("DELETE FROM notes WHERE id = %s RETURNING id", (note_id,))
        return cur.fetchone() is not None


def delete_case(case_id: int) -> bool:
    """Delete a case and all related data (cascades)."""
    with get_cursor() as cur:
        cur.execute("DELETE FROM cases WHERE id = %s RETURNING id", (case_id,))
        return cur.fetchone() is not None


# ===== ADDITIONAL GET OPERATIONS =====

def get_all_contacts() -> List[dict]:
    """Get all contacts."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT id, name, firm, phone, email, address, notes, created_at
            FROM contacts ORDER BY name
        """)
        results = []
        for row in cur.fetchall():
            r = dict(row)
            if r.get("created_at"):
                r["created_at"] = str(r["created_at"])
            results.append(r)
        return results


def get_all_activities(case_id: int = None) -> List[dict]:
    """Get all activities, optionally filtered by case."""
    with get_cursor() as cur:
        if case_id:
            cur.execute("""
                SELECT a.id, a.date, a.description, a.type, a.minutes,
                       c.id as case_id, c.case_name
                FROM activities a
                JOIN cases c ON a.case_id = c.id
                WHERE a.case_id = %s
                ORDER BY a.date DESC
            """, (case_id,))
        else:
            cur.execute("""
                SELECT a.id, a.date, a.description, a.type, a.minutes,
                       c.id as case_id, c.case_name
                FROM activities a
                JOIN cases c ON a.case_id = c.id
                ORDER BY a.date DESC
            """)
        results = []
        for row in cur.fetchall():
            r = dict(row)
            if r.get("date"):
                r["date"] = str(r["date"])
            results.append(r)
        return results


def get_dashboard_stats() -> dict:
    """Get statistics for dashboard."""
    with get_cursor() as cur:
        # Total cases by status
        cur.execute("""
            SELECT status, COUNT(*) as count
            FROM cases
            GROUP BY status
        """)
        cases_by_status = {row["status"]: row["count"] for row in cur.fetchall()}

        # Active cases (not Closed or Settl. Pend.)
        cur.execute("""
            SELECT COUNT(*) as count
            FROM cases
            WHERE status NOT IN ('Closed', 'Settl. Pend.')
        """)
        active_cases = cur.fetchone()["count"]

        # Pending tasks
        cur.execute("""
            SELECT COUNT(*) as count
            FROM tasks
            WHERE status IN ('Pending', 'Active')
        """)
        pending_tasks = cur.fetchone()["count"]

        # Upcoming deadlines (next 30 days)
        cur.execute("""
            SELECT COUNT(*) as count
            FROM deadlines
            WHERE status = 'Pending'
            AND date <= CURRENT_DATE + INTERVAL '30 days'
        """)
        upcoming_deadlines = cur.fetchone()["count"]

        # Urgent items (urgency >= 4)
        cur.execute("""
            SELECT COUNT(*) as count
            FROM tasks
            WHERE urgency >= 4 AND status NOT IN ('Done')
        """)
        urgent_tasks = cur.fetchone()["count"]

        cur.execute("""
            SELECT COUNT(*) as count
            FROM deadlines
            WHERE urgency >= 4 AND status = 'Pending'
        """)
        urgent_deadlines = cur.fetchone()["count"]

        return {
            "active_cases": active_cases,
            "cases_by_status": cases_by_status,
            "pending_tasks": pending_tasks,
            "upcoming_deadlines": upcoming_deadlines,
            "urgent_tasks": urgent_tasks,
            "urgent_deadlines": urgent_deadlines
        }


def update_deadline_full(deadline_id: int, date: str = None, description: str = None,
                         status: str = None, urgency: int = None,
                         document_link: str = None, calculation_note: str = None) -> Optional[dict]:
    """Update a deadline with all fields."""
    updates = {}
    if date is not None:
        updates["date"] = date
    if description is not None:
        updates["description"] = description
    if status is not None:
        updates["status"] = status
    if urgency is not None:
        updates["urgency"] = urgency
    if document_link is not None:
        updates["document_link"] = document_link
    if calculation_note is not None:
        updates["calculation_note"] = calculation_note

    if not updates:
        return None

    set_clause = ", ".join(f"{k} = %s" for k in updates.keys())
    values = list(updates.values()) + [deadline_id]

    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE deadlines SET {set_clause}
            WHERE id = %s
            RETURNING id, date, description, status, urgency, document_link, calculation_note
        """, values)
        result = cur.fetchone()
        if result:
            r = dict(result)
            r["date"] = str(r["date"])
            return r
        return None


def update_task_full(task_id: int, description: str = None, due_date: str = None,
                     status: str = None, urgency: int = None) -> Optional[dict]:
    """Update a task with all fields."""
    updates = {}
    if description is not None:
        updates["description"] = description
    if due_date is not None:
        updates["due_date"] = due_date
    if status is not None:
        updates["status"] = status
    if urgency is not None:
        updates["urgency"] = urgency

    if not updates:
        return None

    set_clause = ", ".join(f"{k} = %s" for k in updates.keys())
    values = list(updates.values()) + [task_id]

    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE tasks SET {set_clause}
            WHERE id = %s
            RETURNING id, due_date, description, status, urgency, case_id
        """, values)
        result = cur.fetchone()
        if result:
            r = dict(result)
            if r.get("due_date"):
                r["due_date"] = str(r["due_date"])
            return r
        return None


# ===== CLIENT UPDATE/DELETE =====

def get_all_clients() -> List[dict]:
    """Get all clients."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT id, name, phone, email, address, notes, created_at
            FROM clients ORDER BY name
        """)
        results = []
        for row in cur.fetchall():
            r = dict(row)
            if r.get("created_at"):
                r["created_at"] = str(r["created_at"])
            results.append(r)
        return results


def get_all_defendants() -> List[dict]:
    """Get all defendants."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT id, name FROM defendants ORDER BY name
        """)
        return [dict(row) for row in cur.fetchall()]


def update_client(client_id: int, name: str = None, phone: str = None,
                  email: str = None, address: str = None, notes: str = None) -> Optional[dict]:
    """Update a client's information."""
    updates = {}
    if name is not None:
        updates["name"] = name
    if phone is not None:
        updates["phone"] = phone
    if email is not None:
        updates["email"] = email
    if address is not None:
        updates["address"] = address
    if notes is not None:
        updates["notes"] = notes

    if not updates:
        return None

    set_clause = ", ".join(f"{k} = %s" for k in updates.keys())
    values = list(updates.values()) + [client_id]

    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE clients SET {set_clause}
            WHERE id = %s
            RETURNING id, name, phone, email, address, notes
        """, values)
        result = cur.fetchone()
        return dict(result) if result else None


def remove_client_from_case(case_id: int, client_id: int) -> bool:
    """Remove a client from a case (does not delete the client)."""
    with get_cursor() as cur:
        cur.execute("""
            DELETE FROM case_clients WHERE case_id = %s AND client_id = %s
            RETURNING id
        """, (case_id, client_id))
        return cur.fetchone() is not None


# ===== CONTACT UPDATE/DELETE =====

def update_contact(contact_id: int, name: str = None, firm: str = None,
                   phone: str = None, email: str = None, address: str = None,
                   notes: str = None) -> Optional[dict]:
    """Update a contact's information."""
    updates = {}
    if name is not None:
        updates["name"] = name
    if firm is not None:
        updates["firm"] = firm
    if phone is not None:
        updates["phone"] = phone
    if email is not None:
        updates["email"] = email
    if address is not None:
        updates["address"] = address
    if notes is not None:
        updates["notes"] = notes

    if not updates:
        return None

    set_clause = ", ".join(f"{k} = %s" for k in updates.keys())
    values = list(updates.values()) + [contact_id]

    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE contacts SET {set_clause}
            WHERE id = %s
            RETURNING id, name, firm, phone, email, address, notes
        """, values)
        result = cur.fetchone()
        return dict(result) if result else None


def remove_contact_from_case(case_id: int, contact_id: int, role: str = None) -> bool:
    """Remove a contact from a case. If role specified, only removes that role."""
    with get_cursor() as cur:
        if role:
            cur.execute("""
                DELETE FROM case_contacts
                WHERE case_id = %s AND contact_id = %s AND role = %s
                RETURNING id
            """, (case_id, contact_id, role))
        else:
            cur.execute("""
                DELETE FROM case_contacts
                WHERE case_id = %s AND contact_id = %s
                RETURNING id
            """, (case_id, contact_id))
        return cur.fetchone() is not None


# ===== ACTIVITY UPDATE/DELETE =====

def update_activity(activity_id: int, date: str = None, description: str = None,
                    activity_type: str = None, minutes: int = None) -> Optional[dict]:
    """Update an activity."""
    updates = {}
    if date is not None:
        updates["date"] = date
    if description is not None:
        updates["description"] = description
    if activity_type is not None:
        updates["type"] = activity_type
    if minutes is not None:
        updates["minutes"] = minutes

    if not updates:
        return None

    set_clause = ", ".join(f"{k} = %s" for k in updates.keys())
    values = list(updates.values()) + [activity_id]

    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE activities SET {set_clause}
            WHERE id = %s
            RETURNING id, date, description, type, minutes
        """, values)
        result = cur.fetchone()
        if result:
            r = dict(result)
            r["date"] = str(r["date"])
            return r
        return None


def delete_activity(activity_id: int) -> bool:
    """Delete an activity by ID."""
    with get_cursor() as cur:
        cur.execute("DELETE FROM activities WHERE id = %s RETURNING id", (activity_id,))
        return cur.fetchone() is not None


# ===== NOTE UPDATE =====

def update_note(note_id: int, content: str) -> Optional[dict]:
    """Update a note's content."""
    with get_cursor() as cur:
        cur.execute("""
            UPDATE notes SET content = %s
            WHERE id = %s
            RETURNING id, content, created_at
        """, (content, note_id))
        result = cur.fetchone()
        if result:
            r = dict(result)
            r["created_at"] = str(r["created_at"])
            return r
        return None


# ===== CASE NUMBER DELETE =====
# NOTE: Case numbers are now stored as JSONB in the cases table.
# Use update_case(case_id, case_numbers=[...]) to modify case numbers.


# ===== DEFENDANT DELETE =====

def remove_defendant_from_case(case_id: int, defendant_id: int) -> bool:
    """Remove a defendant from a case."""
    with get_cursor() as cur:
        cur.execute("""
            DELETE FROM case_defendants WHERE case_id = %s AND defendant_id = %s
            RETURNING id
        """, (case_id, defendant_id))
        return cur.fetchone() is not None


# ===== ADDITIONAL OPERATIONS (NEW) =====

def link_existing_client_to_case(case_id: int, client_id: int, contact_directly: bool = True,
                                  contact_via_id: int = None, contact_via_relationship: str = None,
                                  is_primary: bool = False, notes: str = None) -> Optional[dict]:
    """Link an existing client to a case (without creating a new client)."""
    with get_cursor() as cur:
        # Verify client exists
        cur.execute("SELECT id, name FROM clients WHERE id = %s", (client_id,))
        client = cur.fetchone()
        if not client:
            return None

        # Link to case
        cur.execute("""
            INSERT INTO case_clients (case_id, client_id, contact_directly,
                                      contact_via_id, contact_via_relationship, is_primary, notes)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (case_id, client_id) DO UPDATE SET
                contact_directly = EXCLUDED.contact_directly,
                contact_via_id = EXCLUDED.contact_via_id,
                contact_via_relationship = EXCLUDED.contact_via_relationship,
                is_primary = EXCLUDED.is_primary,
                notes = EXCLUDED.notes
            RETURNING id
        """, (case_id, client_id, contact_directly, contact_via_id,
              contact_via_relationship, is_primary, notes))
        link = cur.fetchone()
        return {"id": link["id"], "client_id": client_id, "client_name": client["name"]}


def update_client_case_link(case_id: int, client_id: int, contact_directly: bool = None,
                            contact_via_id: int = None, contact_via_relationship: str = None,
                            is_primary: bool = None, notes: str = None) -> Optional[dict]:
    """Update the client-case link (contact preferences)."""
    updates = {}
    if contact_directly is not None:
        updates["contact_directly"] = contact_directly
    if contact_via_id is not None:
        updates["contact_via_id"] = contact_via_id
    if contact_via_relationship is not None:
        updates["contact_via_relationship"] = contact_via_relationship
    if is_primary is not None:
        updates["is_primary"] = is_primary
    if notes is not None:
        updates["notes"] = notes

    if not updates:
        return None

    set_clause = ", ".join(f"{k} = %s" for k in updates.keys())
    values = list(updates.values()) + [case_id, client_id]

    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE case_clients SET {set_clause}
            WHERE case_id = %s AND client_id = %s
            RETURNING id, case_id, client_id, contact_directly, contact_via_id,
                      contact_via_relationship, is_primary, notes
        """, values)
        result = cur.fetchone()
        return dict(result) if result else None


def update_defendant(defendant_id: int, name: str) -> Optional[dict]:
    """Update a defendant's name."""
    with get_cursor() as cur:
        cur.execute("""
            UPDATE defendants SET name = %s
            WHERE id = %s
            RETURNING id, name
        """, (name, defendant_id))
        result = cur.fetchone()
        return dict(result) if result else None


def get_client_by_id(client_id: int) -> Optional[dict]:
    """Get a client by ID."""
    with get_cursor() as cur:
        cur.execute("SELECT * FROM clients WHERE id = %s", (client_id,))
        result = cur.fetchone()
        if result:
            r = dict(result)
            if r.get("created_at"):
                r["created_at"] = str(r["created_at"])
            return r
        return None
