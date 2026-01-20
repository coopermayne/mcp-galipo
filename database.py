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
    "Pending", "Active", "Done", "Partially Complete", "Blocked", "Awaiting Atty Review"
]


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


def init_db():
    """Create tables if they don't exist."""
    with get_cursor(dict_cursor=False) as cur:
        # 1. Cases table
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

        # 5. Case_numbers table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS case_numbers (
                id SERIAL PRIMARY KEY,
                case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
                case_number VARCHAR(100) NOT NULL,
                label VARCHAR(50),
                is_primary BOOLEAN DEFAULT FALSE
            )
        """)

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
        # Create sample case
        cur.execute("""
            INSERT INTO cases (case_name, status, court, case_summary, date_of_injury)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
        """, (
            "Martinez v. City of Los Angeles",
            "Discovery",
            "Superior Court of California, Los Angeles County",
            "Police excessive force case. Client injured during traffic stop.",
            "2024-06-15"
        ))
        case_id = cur.fetchone()["id"]

        # Add case number
        cur.execute("""
            INSERT INTO case_numbers (case_id, case_number, label, is_primary)
            VALUES (%s, %s, %s, %s)
        """, (case_id, "24STCV12345", "State", True))

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

def get_all_cases(status_filter: Optional[str] = None) -> List[dict]:
    """Get all cases, optionally filtered by status."""
    with get_cursor() as cur:
        if status_filter:
            cur.execute("""
                SELECT id, case_name, status, court, print_code
                FROM cases
                WHERE status = %s
                ORDER BY case_name
            """, (status_filter,))
        else:
            cur.execute("""
                SELECT id, case_name, status, court, print_code
                FROM cases
                ORDER BY case_name
            """)
        return [dict(row) for row in cur.fetchall()]


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

        # Get case numbers
        cur.execute("""
            SELECT case_number, label, is_primary
            FROM case_numbers WHERE case_id = %s
        """, (case_id,))
        result["case_numbers"] = [dict(row) for row in cur.fetchall()]

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
                date_of_injury: str = None) -> dict:
    """Create a new case."""
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO cases (case_name, status, court, print_code, case_summary, date_of_injury)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (case_name, status, court, print_code, case_summary, date_of_injury))
        case_id = cur.fetchone()["id"]
        return {"id": case_id, "case_name": case_name, "status": status}


def update_case(case_id: int, **kwargs) -> Optional[dict]:
    """Update case fields."""
    allowed_fields = ["case_name", "status", "court", "print_code", "case_summary",
                      "date_of_injury", "claim_due", "claim_filed_date",
                      "complaint_due", "complaint_filed_date", "trial_date"]
    updates = {k: v for k, v in kwargs.items() if k in allowed_fields and v is not None}

    if not updates:
        return None

    set_clause = ", ".join(f"{k} = %s" for k in updates.keys())
    values = list(updates.values()) + [case_id]

    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE cases SET {set_clause}, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING id, case_name, status
        """, values)
        result = cur.fetchone()
        return dict(result) if result else None


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

def add_case_number(case_id: int, case_number: str, label: str = None,
                    is_primary: bool = False) -> dict:
    """Add a case number to a case."""
    with get_cursor() as cur:
        # If this is primary, unset any existing primary
        if is_primary:
            cur.execute("""
                UPDATE case_numbers SET is_primary = FALSE WHERE case_id = %s
            """, (case_id,))

        cur.execute("""
            INSERT INTO case_numbers (case_id, case_number, label, is_primary)
            VALUES (%s, %s, %s, %s)
            RETURNING id, case_number, label, is_primary
        """, (case_id, case_number, label, is_primary))
        return dict(cur.fetchone())


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


def get_upcoming_deadlines(urgency_filter: int = None, status_filter: str = None) -> List[dict]:
    """Get deadlines, optionally filtered by urgency or status."""
    with get_cursor() as cur:
        query = """
            SELECT d.id, d.date, d.description, d.status, d.urgency,
                   d.document_link, d.calculation_note,
                   c.id as case_id, c.case_name
            FROM deadlines d
            JOIN cases c ON d.case_id = c.id
            WHERE 1=1
        """
        params = []

        if urgency_filter:
            query += " AND d.urgency >= %s"
            params.append(urgency_filter)
        if status_filter:
            query += " AND d.status = %s"
            params.append(status_filter)

        query += " ORDER BY d.date"

        cur.execute(query, params)
        results = []
        for row in cur.fetchall():
            r = dict(row)
            r["date"] = str(r["date"])
            results.append(r)
        return results


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
              urgency_filter: int = None) -> List[dict]:
    """Get tasks, optionally filtered by case, status, or urgency."""
    with get_cursor() as cur:
        query = """
            SELECT t.id, t.due_date, t.description, t.status, t.urgency,
                   t.deadline_id, c.id as case_id, c.case_name,
                   d.description as deadline_description, d.date as deadline_date
            FROM tasks t
            JOIN cases c ON t.case_id = c.id
            LEFT JOIN deadlines d ON t.deadline_id = d.id
            WHERE 1=1
        """
        params = []

        if case_id:
            query += " AND t.case_id = %s"
            params.append(case_id)
        if status_filter:
            query += " AND t.status = %s"
            params.append(status_filter)
        if urgency_filter:
            query += " AND t.urgency >= %s"
            params.append(urgency_filter)

        query += " ORDER BY t.due_date NULLS LAST"

        cur.execute(query, params)
        results = []
        for row in cur.fetchall():
            r = dict(row)
            if r.get("due_date"):
                r["due_date"] = str(r["due_date"])
            if r.get("deadline_date"):
                r["deadline_date"] = str(r["deadline_date"])
            results.append(r)
        return results


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

def delete_case_number(case_number_id: int) -> bool:
    """Delete a case number by ID."""
    with get_cursor() as cur:
        cur.execute("DELETE FROM case_numbers WHERE id = %s RETURNING id", (case_number_id,))
        return cur.fetchone() is not None


# ===== DEFENDANT DELETE =====

def remove_defendant_from_case(case_id: int, defendant_id: int) -> bool:
    """Remove a defendant from a case."""
    with get_cursor() as cur:
        cur.execute("""
            DELETE FROM case_defendants WHERE case_id = %s AND defendant_id = %s
            RETURNING id
        """, (case_id, defendant_id))
        return cur.fetchone() is not None
