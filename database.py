"""
Database module for PostgreSQL connection and operations.

Uses DATABASE_URL environment variable (provided by Coolify).
Implements normalized schema for personal injury litigation practice.
"""

import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from typing import Optional, List
from datetime import datetime, date, time

DATABASE_URL = os.environ.get("DATABASE_URL")

# Valid statuses and roles
CASE_STATUSES = [
    "Signing Up", "Prospective", "Pre-Filing", "Pleadings", "Discovery",
    "Expert Discovery", "Pre-trial", "Trial", "Post-Trial", "Appeal",
    "Settl. Pend.", "Stayed", "Closed"
]

TASK_STATUSES = [
    "Pending", "Active", "Done", "Partially Done", "Blocked", "Awaiting Atty Review"
]

ACTIVITY_TYPES = [
    "Meeting", "Filing", "Research", "Drafting", "Document Review",
    "Phone Call", "Email", "Court Appearance", "Deposition", "Other"
]

# Default person types (seeded into person_types table)
DEFAULT_PERSON_TYPES = [
    "client", "attorney", "judge", "expert", "mediator", "defendant",
    "witness", "lien_holder", "interpreter", "court_reporter",
    "process_server", "investigator", "insurance_adjuster", "guardian"
]

# Sides in a case
PERSON_SIDES = ["plaintiff", "defendant", "neutral"]

# Default expertise types for experts
DEFAULT_EXPERTISE_TYPES = [
    "Biomechanics", "Accident Reconstruction", "Medical - Orthopedic",
    "Medical - Neurology", "Medical - General", "Economics/Damages",
    "Vocational Rehabilitation", "Life Care Planning", "Forensic Accounting",
    "Engineering", "Human Factors", "Toxicology", "Psychiatry", "Psychology"
]

# Default jurisdictions
DEFAULT_JURISDICTIONS = [
    {"name": "C.D. Cal.", "local_rules_link": "https://www.cacd.uscourts.gov/court-procedures/local-rules"},
    {"name": "E.D. Cal.", "local_rules_link": "https://www.caed.uscourts.gov/caednew/index.cfm/rules/local-rules/"},
    {"name": "N.D. Cal.", "local_rules_link": "https://www.cand.uscourts.gov/rules/local-rules/"},
    {"name": "S.D. Cal.", "local_rules_link": "https://www.casd.uscourts.gov/rules.aspx"},
    {"name": "9th Cir.", "local_rules_link": "https://www.ca9.uscourts.gov/rules/"},
    {"name": "Los Angeles Superior", "local_rules_link": "https://www.lacourt.org/courtrules/ui/"},
    {"name": "Orange County Superior", "local_rules_link": None},
    {"name": "San Diego Superior", "local_rules_link": None},
    {"name": "Riverside Superior", "local_rules_link": None},
    {"name": "San Bernardino Superior", "local_rules_link": None},
]


class ValidationError(Exception):
    """Raised when input validation fails."""
    pass


def serialize_value(val):
    """Convert datetime/date/time objects to ISO format strings for JSON serialization."""
    if isinstance(val, datetime):
        return val.isoformat()
    elif isinstance(val, date):
        return val.isoformat()
    elif isinstance(val, time):
        return val.strftime("%H:%M")
    return val


def serialize_row(row: dict) -> dict:
    """Serialize a database row, converting datetime objects to strings."""
    if row is None:
        return None
    return {k: serialize_value(v) for k, v in row.items()}


def serialize_rows(rows: list) -> list:
    """Serialize a list of database rows."""
    return [serialize_row(row) for row in rows]


def validate_case_status(status: str) -> str:
    """Validate case status against allowed values."""
    if status not in CASE_STATUSES:
        raise ValidationError(f"Invalid case status '{status}'. Must be one of: {', '.join(CASE_STATUSES)}")
    return status


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


def validate_time_format(time_str: str, field_name: str = "time") -> str:
    """Validate time string is in HH:MM format."""
    if time_str is None:
        return None
    import re
    if not re.match(r'^\d{2}:\d{2}$', time_str):
        raise ValidationError(f"Invalid {field_name} format '{time_str}'. Must be HH:MM.")
    return time_str


def validate_person_type(person_type: str) -> str:
    """Validate person type is a non-empty string. Any type is allowed."""
    if not person_type or not person_type.strip():
        raise ValidationError("Person type cannot be empty")
    return person_type.strip()


def validate_person_side(side: str) -> str:
    """Validate person side against allowed values."""
    if side and side not in PERSON_SIDES:
        raise ValidationError(f"Invalid side '{side}'. Must be one of: {', '.join(PERSON_SIDES)}")
    return side


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
    """Drop all existing tables for clean reset."""
    with get_cursor(dict_cursor=False) as cur:
        cur.execute("""
            DROP TABLE IF EXISTS notes CASCADE;
            DROP TABLE IF EXISTS tasks CASCADE;
            DROP TABLE IF EXISTS deadlines CASCADE;
            DROP TABLE IF EXISTS activities CASCADE;
            DROP TABLE IF EXISTS case_persons CASCADE;
            DROP TABLE IF EXISTS expertise_types CASCADE;
            DROP TABLE IF EXISTS person_types CASCADE;
            DROP TABLE IF EXISTS persons CASCADE;
            DROP TABLE IF EXISTS cases CASCADE;
            DROP TABLE IF EXISTS jurisdictions CASCADE;
        """)
    print("All tables dropped.")


def migrate_db():
    """Migrate existing database schema to new version.

    This function handles incremental schema changes for production databases
    that already have data. It should be idempotent (safe to run multiple times).
    """
    with get_cursor(dict_cursor=False) as cur:
        # Check if we need to migrate by looking for old schema indicators
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'cases'
            ) as cases_exists
        """)
        cases_exists = cur.fetchone()[0]

        if not cases_exists:
            # Fresh install, no migration needed
            print("No existing tables found, skipping migration.")
            return

        print("Running database migrations...")

        # 1. Create jurisdictions table if it doesn't exist
        cur.execute("""
            CREATE TABLE IF NOT EXISTS jurisdictions (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                local_rules_link TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 2. Seed jurisdictions from old court values if empty
        cur.execute("SELECT COUNT(*) FROM jurisdictions")
        if cur.fetchone()[0] == 0:
            # Get unique court values from cases and create jurisdictions
            cur.execute("SELECT DISTINCT court FROM cases WHERE court IS NOT NULL AND court != ''")
            courts = [row[0] for row in cur.fetchall()]
            for court_name in courts:
                cur.execute(
                    "INSERT INTO jurisdictions (name) VALUES (%s) ON CONFLICT (name) DO NOTHING",
                    (court_name,)
                )
            # Also add default jurisdictions
            for j in DEFAULT_JURISDICTIONS:
                cur.execute(
                    "INSERT INTO jurisdictions (name, local_rules_link) VALUES (%s, %s) ON CONFLICT (name) DO NOTHING",
                    (j["name"], j.get("local_rules_link"))
                )

        # 3. Add court_id column to cases if it doesn't exist
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_name = 'cases' AND column_name = 'court_id'
            )
        """)
        if not cur.fetchone()[0]:
            cur.execute("ALTER TABLE cases ADD COLUMN court_id INTEGER REFERENCES jurisdictions(id)")
            # Migrate court string to court_id
            cur.execute("""
                UPDATE cases c
                SET court_id = j.id
                FROM jurisdictions j
                WHERE c.court = j.name AND c.court_id IS NULL
            """)
            print("  - Added court_id column to cases")

        # 4. Add result column to cases if it doesn't exist
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_name = 'cases' AND column_name = 'result'
            )
        """)
        if not cur.fetchone()[0]:
            cur.execute("ALTER TABLE cases ADD COLUMN result TEXT")
            print("  - Added result column to cases")

        # 5. Add short_name column to cases if it doesn't exist
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_name = 'cases' AND column_name = 'short_name'
            )
        """)
        if not cur.fetchone()[0]:
            cur.execute("ALTER TABLE cases ADD COLUMN short_name VARCHAR(100)")
            print("  - Added short_name column to cases")

        # 6. Create persons table if it doesn't exist
        cur.execute("""
            CREATE TABLE IF NOT EXISTS persons (
                id SERIAL PRIMARY KEY,
                person_type VARCHAR(50) NOT NULL,
                name VARCHAR(255) NOT NULL,
                phones JSONB DEFAULT '[]',
                emails JSONB DEFAULT '[]',
                address TEXT,
                organization VARCHAR(255),
                attributes JSONB DEFAULT '{}',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                archived BOOLEAN DEFAULT FALSE
            )
        """)

        # 7. Create case_persons junction table if it doesn't exist
        cur.execute("""
            CREATE TABLE IF NOT EXISTS case_persons (
                id SERIAL PRIMARY KEY,
                case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
                person_id INTEGER REFERENCES persons(id) ON DELETE CASCADE,
                role VARCHAR(100) NOT NULL,
                side VARCHAR(20) DEFAULT 'neutral',
                case_attributes JSONB DEFAULT '{}',
                case_notes TEXT,
                is_primary BOOLEAN DEFAULT FALSE,
                contact_via_person_id INTEGER REFERENCES persons(id),
                assigned_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(case_id, person_id, role)
            )
        """)

        # 8. Create person_types table if it doesn't exist
        cur.execute("""
            CREATE TABLE IF NOT EXISTS person_types (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 9. Create expertise_types table if it doesn't exist
        cur.execute("""
            CREATE TABLE IF NOT EXISTS expertise_types (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 10. Add time and location columns to deadlines if they don't exist
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_name = 'deadlines' AND column_name = 'time'
            )
        """)
        if not cur.fetchone()[0]:
            cur.execute("ALTER TABLE deadlines ADD COLUMN time TIME")
            print("  - Added time column to deadlines")

        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_name = 'deadlines' AND column_name = 'location'
            )
        """)
        if not cur.fetchone()[0]:
            cur.execute("ALTER TABLE deadlines ADD COLUMN location TEXT")
            print("  - Added location column to deadlines")

        # 11. Add completion_date column to tasks if it doesn't exist
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_name = 'tasks' AND column_name = 'completion_date'
            )
        """)
        if not cur.fetchone()[0]:
            cur.execute("ALTER TABLE tasks ADD COLUMN completion_date DATE")
            print("  - Added completion_date column to tasks")

        # 12. Migrate old clients table to persons if it exists and has expected structure
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_name = 'clients' AND column_name = 'case_id'
            )
        """)
        clients_has_case_id = cur.fetchone()[0]

        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'clients'
            )
        """)
        if cur.fetchone()[0]:
            # Check what columns exist in clients table
            cur.execute("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'clients'
            """)
            client_cols = {row[0] for row in cur.fetchall()}

            # Build dynamic insert based on available columns
            if 'name' in client_cols:
                phone_expr = "CASE WHEN phone IS NOT NULL AND phone != '' THEN jsonb_build_array(jsonb_build_object('value', phone, 'primary', true)) ELSE '[]'::jsonb END" if 'phone' in client_cols else "'[]'::jsonb"
                email_expr = "CASE WHEN email IS NOT NULL AND email != '' THEN jsonb_build_array(jsonb_build_object('value', email, 'primary', true)) ELSE '[]'::jsonb END" if 'email' in client_cols else "'[]'::jsonb"
                notes_expr = "notes" if 'notes' in client_cols else "NULL"

                cur.execute(f"""
                    INSERT INTO persons (person_type, name, phones, emails, notes, created_at)
                    SELECT
                        'client',
                        name,
                        {phone_expr},
                        {email_expr},
                        {notes_expr},
                        COALESCE(created_at, CURRENT_TIMESTAMP)
                    FROM clients
                    WHERE NOT EXISTS (
                        SELECT 1 FROM persons p WHERE p.name = clients.name AND p.person_type = 'client'
                    )
                """)

                # Only migrate relationships if case_id column exists
                if clients_has_case_id:
                    is_primary_expr = "c.is_primary" if 'is_primary' in client_cols else "false"
                    cur.execute(f"""
                        INSERT INTO case_persons (case_id, person_id, role, side, is_primary)
                        SELECT
                            c.case_id,
                            p.id,
                            'Client',
                            'plaintiff',
                            {is_primary_expr}
                        FROM clients c
                        JOIN persons p ON p.name = c.name AND p.person_type = 'client'
                        WHERE NOT EXISTS (
                            SELECT 1 FROM case_persons cp
                            WHERE cp.case_id = c.case_id AND cp.person_id = p.id AND cp.role = 'Client'
                        )
                    """)
                print("  - Migrated clients to persons table")

        # 13. Migrate old defendants table to persons if it exists
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_name = 'defendants' AND column_name = 'case_id'
            )
        """)
        defendants_has_case_id = cur.fetchone()[0]

        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'defendants'
            )
        """)
        if cur.fetchone()[0]:
            cur.execute("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'defendants'
            """)
            defendant_cols = {row[0] for row in cur.fetchall()}

            if 'name' in defendant_cols:
                created_at_expr = "COALESCE(created_at, CURRENT_TIMESTAMP)" if 'created_at' in defendant_cols else "CURRENT_TIMESTAMP"
                cur.execute(f"""
                    INSERT INTO persons (person_type, name, created_at)
                    SELECT
                        'defendant',
                        name,
                        {created_at_expr}
                    FROM defendants
                    WHERE NOT EXISTS (
                        SELECT 1 FROM persons p WHERE p.name = defendants.name AND p.person_type = 'defendant'
                    )
                """)

                if defendants_has_case_id:
                    cur.execute("""
                        INSERT INTO case_persons (case_id, person_id, role, side)
                        SELECT
                            d.case_id,
                            p.id,
                            'Defendant',
                            'defendant'
                        FROM defendants d
                        JOIN persons p ON p.name = d.name AND p.person_type = 'defendant'
                        WHERE NOT EXISTS (
                            SELECT 1 FROM case_persons cp
                            WHERE cp.case_id = d.case_id AND cp.person_id = p.id AND cp.role = 'Defendant'
                        )
                    """)
                print("  - Migrated defendants to persons table")

        # 14. Migrate old contacts table to persons if it exists
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_name = 'contacts' AND column_name = 'case_id'
            )
        """)
        contacts_has_case_id = cur.fetchone()[0]

        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'contacts'
            )
        """)
        if cur.fetchone()[0]:
            cur.execute("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'contacts'
            """)
            contact_cols = {row[0] for row in cur.fetchall()}

            if 'name' in contact_cols:
                phone_expr = "CASE WHEN phone IS NOT NULL AND phone != '' THEN jsonb_build_array(jsonb_build_object('value', phone, 'primary', true)) ELSE '[]'::jsonb END" if 'phone' in contact_cols else "'[]'::jsonb"
                email_expr = "CASE WHEN email IS NOT NULL AND email != '' THEN jsonb_build_array(jsonb_build_object('value', email, 'primary', true)) ELSE '[]'::jsonb END" if 'email' in contact_cols else "'[]'::jsonb"
                firm_expr = "firm" if 'firm' in contact_cols else "NULL"
                created_at_expr = "COALESCE(created_at, CURRENT_TIMESTAMP)" if 'created_at' in contact_cols else "CURRENT_TIMESTAMP"

                cur.execute(f"""
                    INSERT INTO persons (person_type, name, phones, emails, organization, created_at)
                    SELECT
                        'attorney',
                        name,
                        {phone_expr},
                        {email_expr},
                        {firm_expr},
                        {created_at_expr}
                    FROM contacts
                    WHERE NOT EXISTS (
                        SELECT 1 FROM persons p WHERE p.name = contacts.name
                    )
                """)

                if contacts_has_case_id:
                    role_expr = "COALESCE(c.role, 'Contact')" if 'role' in contact_cols else "'Contact'"
                    cur.execute(f"""
                        INSERT INTO case_persons (case_id, person_id, role, side)
                        SELECT
                            c.case_id,
                            p.id,
                            {role_expr},
                            'neutral'
                        FROM contacts c
                        JOIN persons p ON p.name = c.name
                        WHERE NOT EXISTS (
                            SELECT 1 FROM case_persons cp
                            WHERE cp.case_id = c.case_id AND cp.person_id = p.id
                        )
                    """)
                print("  - Migrated contacts to persons table")

        # 15. Add starred column to deadlines if it doesn't exist
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_name = 'deadlines' AND column_name = 'starred'
            )
        """)
        if not cur.fetchone()[0]:
            cur.execute("ALTER TABLE deadlines ADD COLUMN starred BOOLEAN DEFAULT FALSE")
            print("  - Added starred column to deadlines")

        # 16. Drop obsolete date columns from cases if they exist
        obsolete_columns = ['claim_due', 'claim_filed_date', 'complaint_due', 'complaint_filed_date', 'trial_date']
        for col in obsolete_columns:
            cur.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.columns
                    WHERE table_name = 'cases' AND column_name = %s
                )
            """, (col,))
            if cur.fetchone()[0]:
                cur.execute(f"ALTER TABLE cases DROP COLUMN {col}")
                print(f"  - Dropped {col} column from cases")

        # 17. Drop urgency column from deadlines if it exists
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_name = 'deadlines' AND column_name = 'urgency'
            )
        """)
        if cur.fetchone()[0]:
            cur.execute("ALTER TABLE deadlines DROP COLUMN urgency")
            print("  - Dropped urgency column from deadlines")

        # 18. Drop status column from deadlines if it exists
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_name = 'deadlines' AND column_name = 'status'
            )
        """)
        if cur.fetchone()[0]:
            cur.execute("ALTER TABLE deadlines DROP COLUMN status")
            print("  - Dropped status column from deadlines")

        print("Database migration complete.")


def init_db():
    """Create tables if they don't exist."""
    with get_cursor(dict_cursor=False) as cur:
        # 1. Jurisdictions table (must be created before cases for FK)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS jurisdictions (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                local_rules_link TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 2. Cases table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS cases (
                id SERIAL PRIMARY KEY,
                case_name VARCHAR(255) NOT NULL,
                short_name VARCHAR(100),
                status VARCHAR(50) NOT NULL DEFAULT 'Signing Up',
                court_id INTEGER REFERENCES jurisdictions(id),
                print_code VARCHAR(50),
                case_summary TEXT,
                result TEXT,
                date_of_injury DATE,
                case_numbers JSONB DEFAULT '[]',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 3. Persons table (unified person entity)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS persons (
                id SERIAL PRIMARY KEY,
                person_type VARCHAR(50) NOT NULL,
                name VARCHAR(255) NOT NULL,
                phones JSONB DEFAULT '[]',
                emails JSONB DEFAULT '[]',
                address TEXT,
                organization VARCHAR(255),
                attributes JSONB DEFAULT '{}',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                archived BOOLEAN DEFAULT FALSE
            )
        """)

        # 4. Person types table (extendable enum)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS person_types (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 5. Expertise types table (extendable enum for experts)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS expertise_types (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 6. Case persons junction table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS case_persons (
                id SERIAL PRIMARY KEY,
                case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
                person_id INTEGER REFERENCES persons(id) ON DELETE CASCADE,
                role VARCHAR(100) NOT NULL,
                side VARCHAR(20),
                case_attributes JSONB DEFAULT '{}',
                case_notes TEXT,
                is_primary BOOLEAN DEFAULT FALSE,
                contact_via_person_id INTEGER REFERENCES persons(id),
                assigned_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(case_id, person_id, role)
            )
        """)

        # 7. Activities table
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

        # 8. Deadlines table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS deadlines (
                id SERIAL PRIMARY KEY,
                case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
                date DATE NOT NULL,
                time TIME,
                location VARCHAR(255),
                description TEXT NOT NULL,
                document_link TEXT,
                calculation_note TEXT,
                starred BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 9. Tasks table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
                deadline_id INTEGER REFERENCES deadlines(id) ON DELETE SET NULL,
                due_date DATE,
                completion_date DATE,
                description TEXT NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'Pending',
                urgency INTEGER CHECK (urgency >= 1 AND urgency <= 5) DEFAULT 3,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 10. Notes table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS notes (
                id SERIAL PRIMARY KEY,
                case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Create indexes for better query performance
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
            CREATE INDEX IF NOT EXISTS idx_cases_court_id ON cases(court_id);
            CREATE INDEX IF NOT EXISTS idx_persons_name ON persons(name);
            CREATE INDEX IF NOT EXISTS idx_persons_type ON persons(person_type);
            CREATE INDEX IF NOT EXISTS idx_persons_archived ON persons(archived);
            CREATE INDEX IF NOT EXISTS idx_persons_attributes ON persons USING GIN (attributes);
            CREATE INDEX IF NOT EXISTS idx_case_persons_case_id ON case_persons(case_id);
            CREATE INDEX IF NOT EXISTS idx_case_persons_person_id ON case_persons(person_id);
            CREATE INDEX IF NOT EXISTS idx_case_persons_role ON case_persons(role);
            CREATE INDEX IF NOT EXISTS idx_tasks_case_id ON tasks(case_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
            CREATE INDEX IF NOT EXISTS idx_deadlines_case_id ON deadlines(case_id);
            CREATE INDEX IF NOT EXISTS idx_deadlines_date ON deadlines(date);
            CREATE INDEX IF NOT EXISTS idx_activities_case_id ON activities(case_id);
            CREATE INDEX IF NOT EXISTS idx_notes_case_id ON notes(case_id);
        """)

    print("Database tables initialized.")


def seed_jurisdictions():
    """Seed initial jurisdictions if the table is empty."""
    with get_cursor() as cur:
        cur.execute("SELECT COUNT(*) as count FROM jurisdictions")
        if cur.fetchone()["count"] > 0:
            return  # Already seeded

        for j in DEFAULT_JURISDICTIONS:
            cur.execute("""
                INSERT INTO jurisdictions (name, local_rules_link)
                VALUES (%s, %s)
                ON CONFLICT (name) DO NOTHING
            """, (j["name"], j.get("local_rules_link")))
    print(f"Seeded {len(DEFAULT_JURISDICTIONS)} jurisdictions.")


def seed_expertise_types():
    """Seed initial expertise types if the table is empty."""
    with get_cursor() as cur:
        cur.execute("SELECT COUNT(*) as count FROM expertise_types")
        if cur.fetchone()["count"] > 0:
            return  # Already seeded

        for name in DEFAULT_EXPERTISE_TYPES:
            cur.execute("""
                INSERT INTO expertise_types (name)
                VALUES (%s)
                ON CONFLICT (name) DO NOTHING
            """, (name,))
    print(f"Seeded {len(DEFAULT_EXPERTISE_TYPES)} expertise types.")


def seed_person_types():
    """Seed initial person types if the table is empty."""
    with get_cursor() as cur:
        cur.execute("SELECT COUNT(*) as count FROM person_types")
        if cur.fetchone()["count"] > 0:
            return  # Already seeded

        for name in DEFAULT_PERSON_TYPES:
            cur.execute("""
                INSERT INTO person_types (name)
                VALUES (%s)
                ON CONFLICT (name) DO NOTHING
            """, (name,))
    print(f"Seeded {len(DEFAULT_PERSON_TYPES)} person types.")


def seed_db():
    """Seed all lookup tables."""
    seed_jurisdictions()
    seed_expertise_types()
    seed_person_types()
    print("Database seeded with lookup data.")


# ===== JURISDICTION OPERATIONS =====

def get_jurisdictions() -> List[dict]:
    """Get all jurisdictions."""
    with get_cursor() as cur:
        cur.execute("SELECT id, name, local_rules_link, notes FROM jurisdictions ORDER BY name")
        return [dict(row) for row in cur.fetchall()]


def get_jurisdiction_by_id(jurisdiction_id: int) -> Optional[dict]:
    """Get a jurisdiction by ID."""
    with get_cursor() as cur:
        cur.execute("SELECT id, name, local_rules_link, notes FROM jurisdictions WHERE id = %s", (jurisdiction_id,))
        row = cur.fetchone()
        return dict(row) if row else None


def get_jurisdiction_by_name(name: str) -> Optional[dict]:
    """Get a jurisdiction by name."""
    with get_cursor() as cur:
        cur.execute("SELECT id, name, local_rules_link, notes FROM jurisdictions WHERE name = %s", (name,))
        row = cur.fetchone()
        return dict(row) if row else None


def create_jurisdiction(name: str, local_rules_link: str = None, notes: str = None) -> dict:
    """Create a new jurisdiction."""
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO jurisdictions (name, local_rules_link, notes)
            VALUES (%s, %s, %s)
            RETURNING id, name, local_rules_link, notes
        """, (name, local_rules_link, notes))
        return dict(cur.fetchone())


def update_jurisdiction(jurisdiction_id: int, name: str = None, local_rules_link: str = None, notes: str = None) -> Optional[dict]:
    """Update a jurisdiction."""
    updates = []
    params = []
    if name is not None:
        updates.append("name = %s")
        params.append(name)
    if local_rules_link is not None:
        updates.append("local_rules_link = %s")
        params.append(local_rules_link)
    if notes is not None:
        updates.append("notes = %s")
        params.append(notes)

    if not updates:
        return get_jurisdiction_by_id(jurisdiction_id)

    params.append(jurisdiction_id)
    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE jurisdictions SET {', '.join(updates)}
            WHERE id = %s
            RETURNING id, name, local_rules_link, notes
        """, params)
        row = cur.fetchone()
        return dict(row) if row else None


# ===== CASE OPERATIONS =====

def get_all_cases(status_filter: Optional[str] = None, limit: int = None,
                  offset: int = None) -> dict:
    """Get all cases with optional status filter."""
    conditions = []
    params = []

    if status_filter:
        validate_case_status(status_filter)
        conditions.append("c.status = %s")
        params.append(status_filter)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with get_cursor() as cur:
        # Get total count
        cur.execute(f"SELECT COUNT(*) as total FROM cases c {where_clause}", params)
        total = cur.fetchone()["total"]

        # Build query with joins for counts, court name, and assigned judge
        query = f"""
            SELECT c.id, c.case_name, c.short_name, c.status, c.print_code,
                   j.name as court,
                   (SELECT p.name FROM case_persons cp
                    JOIN persons p ON cp.person_id = p.id
                    WHERE cp.case_id = c.id AND cp.role = 'Judge'
                    LIMIT 1) as judge,
                   (SELECT COUNT(*) FROM case_persons cp WHERE cp.case_id = c.id AND cp.role = 'Client') as client_count,
                   (SELECT COUNT(*) FROM case_persons cp WHERE cp.case_id = c.id AND cp.role = 'Defendant') as defendant_count,
                   (SELECT COUNT(*) FROM tasks t WHERE t.case_id = c.id AND t.status = 'Pending') as pending_task_count,
                   (SELECT COUNT(*) FROM deadlines d WHERE d.case_id = c.id AND d.date >= CURRENT_DATE) as upcoming_deadline_count
            FROM cases c
            LEFT JOIN jurisdictions j ON c.court_id = j.id
            {where_clause}
            ORDER BY c.case_name
        """

        if limit:
            query += f" LIMIT {limit}"
        if offset:
            query += f" OFFSET {offset}"

        cur.execute(query, params)
        cases = [dict(row) for row in cur.fetchall()]

    return {"cases": cases, "total": total}


def get_case_by_id(case_id: int) -> Optional[dict]:
    """Get full case details by ID with all related data."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT c.*, j.name as court, j.local_rules_link
            FROM cases c
            LEFT JOIN jurisdictions j ON c.court_id = j.id
            WHERE c.id = %s
        """, (case_id,))
        case = cur.fetchone()
        if not case:
            return None

        result = serialize_row(dict(case))

        # Parse case_numbers JSONB
        if result.get("case_numbers"):
            case_nums = result["case_numbers"]
            if isinstance(case_nums, str):
                case_nums = json.loads(case_nums)
            result["case_numbers"] = case_nums
        else:
            result["case_numbers"] = []

        # Get persons assigned to this case
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
            WHERE cp.case_id = %s
            ORDER BY
                CASE cp.role
                    WHEN 'Client' THEN 1
                    WHEN 'Defendant' THEN 2
                    ELSE 3
                END,
                p.name
        """, (case_id,))
        result["persons"] = serialize_rows([dict(row) for row in cur.fetchall()])

        # Get activities
        cur.execute("""
            SELECT id, date, description, type, minutes
            FROM activities WHERE case_id = %s ORDER BY date DESC
        """, (case_id,))
        result["activities"] = serialize_rows([dict(row) for row in cur.fetchall()])

        # Get deadlines
        cur.execute("""
            SELECT id, date, time, location, description, document_link, calculation_note, starred
            FROM deadlines WHERE case_id = %s ORDER BY date
        """, (case_id,))
        result["deadlines"] = serialize_rows([dict(row) for row in cur.fetchall()])

        # Get tasks
        cur.execute("""
            SELECT t.id, t.due_date, t.completion_date, t.description, t.status, t.urgency, t.deadline_id,
                   d.description as deadline_description
            FROM tasks t
            LEFT JOIN deadlines d ON t.deadline_id = d.id
            WHERE t.case_id = %s ORDER BY t.due_date
        """, (case_id,))
        result["tasks"] = serialize_rows([dict(row) for row in cur.fetchall()])

        # Get notes
        cur.execute("""
            SELECT id, content, created_at, updated_at
            FROM notes WHERE case_id = %s ORDER BY created_at DESC
        """, (case_id,))
        result["notes"] = serialize_rows([dict(row) for row in cur.fetchall()])

        return result


def get_case_by_name(case_name: str) -> Optional[dict]:
    """Get case by name."""
    with get_cursor() as cur:
        cur.execute("SELECT id FROM cases WHERE case_name = %s", (case_name,))
        case = cur.fetchone()
        if not case:
            return None
        return get_case_by_id(case["id"])


def get_all_case_names() -> List[str]:
    """Get list of all case names."""
    with get_cursor() as cur:
        cur.execute("SELECT case_name FROM cases ORDER BY case_name")
        return [row["case_name"] for row in cur.fetchall()]


def create_case(case_name: str, status: str = "Signing Up", court_id: int = None,
                print_code: str = None, case_summary: str = None, result: str = None,
                date_of_injury: str = None, case_numbers: List[dict] = None,
                short_name: str = None) -> dict:
    """Create a new case."""
    validate_case_status(status)
    validate_date_format(date_of_injury, "date_of_injury")
    case_numbers_json = json.dumps(case_numbers) if case_numbers else '[]'

    # Default short_name to first word of case_name
    if short_name is None:
        short_name = case_name.split()[0] if case_name else None

    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO cases (case_name, short_name, status, court_id, print_code, case_summary, result, date_of_injury, case_numbers)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (case_name, short_name, status, court_id, print_code, case_summary, result, date_of_injury, case_numbers_json))
        case_id = cur.fetchone()["id"]

    return get_case_by_id(case_id)


def update_case(case_id: int, **kwargs) -> Optional[dict]:
    """Update case fields."""
    allowed_fields = [
        "case_name", "short_name", "status", "court_id", "print_code",
        "case_summary", "result", "date_of_injury", "case_numbers"
    ]

    updates = []
    params = []

    for field, value in kwargs.items():
        if field not in allowed_fields:
            continue
        if value is None:
            continue

        if field == "status":
            validate_case_status(value)
        elif field == "date_of_injury":
            validate_date_format(value, field)
        elif field == "case_numbers":
            value = json.dumps(value) if isinstance(value, list) else value

        updates.append(f"{field} = %s")
        params.append(value)

    if not updates:
        return get_case_by_id(case_id)

    updates.append("updated_at = CURRENT_TIMESTAMP")
    params.append(case_id)

    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE cases SET {', '.join(updates)}
            WHERE id = %s
            RETURNING id
        """, params)
        row = cur.fetchone()
        if not row:
            return None

    return get_case_by_id(case_id)


def delete_case(case_id: int) -> bool:
    """Delete a case and all related data."""
    with get_cursor() as cur:
        cur.execute("DELETE FROM cases WHERE id = %s", (case_id,))
        return cur.rowcount > 0


def search_cases(query: str = None, case_number: str = None, person_name: str = None,
                 status: str = None, court_id: int = None, limit: int = 50) -> List[dict]:
    """Search cases by various criteria."""
    conditions = []
    params = []

    if query:
        conditions.append("(c.case_name ILIKE %s OR c.case_summary ILIKE %s)")
        params.extend([f"%{query}%", f"%{query}%"])

    if case_number:
        conditions.append("c.case_numbers::text ILIKE %s")
        params.append(f"%{case_number}%")

    if person_name:
        conditions.append("""
            EXISTS (
                SELECT 1 FROM case_persons cp
                JOIN persons p ON cp.person_id = p.id
                WHERE cp.case_id = c.id AND p.name ILIKE %s
            )
        """)
        params.append(f"%{person_name}%")

    if status:
        validate_case_status(status)
        conditions.append("c.status = %s")
        params.append(status)

    if court_id:
        conditions.append("c.court_id = %s")
        params.append(court_id)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with get_cursor() as cur:
        cur.execute(f"""
            SELECT c.id, c.case_name, c.short_name, c.status, c.case_summary,
                   j.name as court, c.case_numbers
            FROM cases c
            LEFT JOIN jurisdictions j ON c.court_id = j.id
            {where_clause}
            ORDER BY c.case_name
            LIMIT %s
        """, params + [limit])

        results = []
        for row in cur.fetchall():
            r = dict(row)
            if r.get("case_numbers") and isinstance(r["case_numbers"], str):
                r["case_numbers"] = json.loads(r["case_numbers"])
            results.append(r)
        return results


# ===== PERSON OPERATIONS =====

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


# ===== EXPERTISE TYPE OPERATIONS =====

def get_expertise_types() -> List[dict]:
    """Get all expertise types."""
    with get_cursor() as cur:
        cur.execute("SELECT id, name, description FROM expertise_types ORDER BY name")
        return [dict(row) for row in cur.fetchall()]


def create_expertise_type(name: str, description: str = None) -> dict:
    """Create a new expertise type."""
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO expertise_types (name, description)
            VALUES (%s, %s)
            RETURNING id, name, description
        """, (name, description))
        return dict(cur.fetchone())


# ===== PERSON TYPE OPERATIONS =====

def get_person_types() -> List[dict]:
    """Get all person types."""
    with get_cursor() as cur:
        cur.execute("SELECT id, name, description FROM person_types ORDER BY name")
        return [dict(row) for row in cur.fetchall()]


def create_person_type(name: str, description: str = None) -> dict:
    """Create a new person type."""
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO person_types (name, description)
            VALUES (%s, %s)
            RETURNING id, name, description
        """, (name, description))
        return dict(cur.fetchone())


# ===== TASK OPERATIONS =====

def add_task(case_id: int, description: str, due_date: str = None,
             status: str = "Pending", urgency: int = 3, deadline_id: int = None) -> dict:
    """Add a task to a case."""
    validate_task_status(status)
    validate_urgency(urgency)
    validate_date_format(due_date, "due_date")

    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO tasks (case_id, description, due_date, status, urgency, deadline_id)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, case_id, description, due_date, completion_date, status, urgency, deadline_id, created_at
        """, (case_id, description, due_date, status, urgency, deadline_id))
        return serialize_row(dict(cur.fetchone()))


def get_tasks(case_id: int = None, status_filter: str = None,
              urgency_filter: int = None, limit: int = None, offset: int = None) -> dict:
    """Get tasks with optional filters."""
    conditions = []
    params = []

    if case_id:
        conditions.append("t.case_id = %s")
        params.append(case_id)

    if status_filter:
        validate_task_status(status_filter)
        conditions.append("t.status = %s")
        params.append(status_filter)

    if urgency_filter:
        validate_urgency(urgency_filter)
        conditions.append("t.urgency = %s")
        params.append(urgency_filter)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with get_cursor() as cur:
        cur.execute(f"SELECT COUNT(*) as total FROM tasks t {where_clause}", params)
        total = cur.fetchone()["total"]

        query = f"""
            SELECT t.id, t.case_id, c.case_name, c.short_name, t.description,
                   t.due_date, t.completion_date, t.status, t.urgency, t.deadline_id, t.created_at
            FROM tasks t
            JOIN cases c ON t.case_id = c.id
            {where_clause}
            ORDER BY t.due_date NULLS LAST, t.urgency DESC
        """
        if limit:
            query += f" LIMIT {limit}"
        if offset:
            query += f" OFFSET {offset}"

        cur.execute(query, params)
        return {"tasks": serialize_rows([dict(row) for row in cur.fetchall()]), "total": total}


def update_task(task_id: int, status: str = None, urgency: int = None) -> Optional[dict]:
    """Update task status and/or urgency."""
    updates = []
    params = []

    if status:
        validate_task_status(status)
        updates.append("status = %s")
        params.append(status)
        # Auto-set completion_date when marking as Done
        if status == "Done":
            updates.append("completion_date = CURRENT_DATE")

    if urgency:
        validate_urgency(urgency)
        updates.append("urgency = %s")
        params.append(urgency)

    if not updates:
        return None

    params.append(task_id)

    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE tasks SET {', '.join(updates)}
            WHERE id = %s
            RETURNING id, case_id, description, due_date, completion_date, status, urgency, deadline_id, created_at
        """, params)
        row = cur.fetchone()
        return serialize_row(dict(row)) if row else None


def update_task_full(task_id: int, description: str = None, due_date: str = None,
                     completion_date: str = None, status: str = None, urgency: int = None) -> Optional[dict]:
    """Update all task fields."""
    updates = []
    params = []

    if description is not None:
        updates.append("description = %s")
        params.append(description)

    if due_date is not None:
        validate_date_format(due_date, "due_date")
        updates.append("due_date = %s")
        params.append(due_date if due_date else None)

    if completion_date is not None:
        validate_date_format(completion_date, "completion_date")
        updates.append("completion_date = %s")
        params.append(completion_date if completion_date else None)

    if status is not None:
        validate_task_status(status)
        updates.append("status = %s")
        params.append(status)

    if urgency is not None:
        validate_urgency(urgency)
        updates.append("urgency = %s")
        params.append(urgency)

    if not updates:
        return None

    params.append(task_id)

    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE tasks SET {', '.join(updates)}
            WHERE id = %s
            RETURNING id, case_id, description, due_date, completion_date, status, urgency, deadline_id, created_at
        """, params)
        row = cur.fetchone()
        return serialize_row(dict(row)) if row else None


def delete_task(task_id: int) -> bool:
    """Delete a task."""
    with get_cursor() as cur:
        cur.execute("DELETE FROM tasks WHERE id = %s", (task_id,))
        return cur.rowcount > 0


def bulk_update_tasks(task_ids: List[int], status: str) -> dict:
    """Update status for multiple tasks."""
    validate_task_status(status)
    with get_cursor() as cur:
        cur.execute("""
            UPDATE tasks SET status = %s
            WHERE id = ANY(%s)
        """, (status, task_ids))
        return {"updated": cur.rowcount}


def bulk_update_tasks_for_case(case_id: int, status: str, current_status: str = None) -> dict:
    """Update all tasks for a case, optionally filtering by current status."""
    validate_task_status(status)
    with get_cursor() as cur:
        if current_status:
            validate_task_status(current_status)
            cur.execute("""
                UPDATE tasks SET status = %s
                WHERE case_id = %s AND status = %s
            """, (status, case_id, current_status))
        else:
            cur.execute("""
                UPDATE tasks SET status = %s
                WHERE case_id = %s
            """, (status, case_id))
        return {"updated": cur.rowcount}


def search_tasks(query: str = None, case_id: int = None, status: str = None,
                 urgency: int = None, limit: int = 50) -> List[dict]:
    """Search tasks by various criteria."""
    conditions = []
    params = []

    if query:
        conditions.append("t.description ILIKE %s")
        params.append(f"%{query}%")

    if case_id:
        conditions.append("t.case_id = %s")
        params.append(case_id)

    if status:
        validate_task_status(status)
        conditions.append("t.status = %s")
        params.append(status)

    if urgency:
        validate_urgency(urgency)
        conditions.append("t.urgency = %s")
        params.append(urgency)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with get_cursor() as cur:
        cur.execute(f"""
            SELECT t.id, t.case_id, c.case_name, c.short_name, t.description,
                   t.due_date, t.completion_date, t.status, t.urgency
            FROM tasks t
            JOIN cases c ON t.case_id = c.id
            {where_clause}
            ORDER BY t.due_date NULLS LAST, t.urgency DESC
            LIMIT %s
        """, params + [limit])
        return [dict(row) for row in cur.fetchall()]


# ===== DEADLINE OPERATIONS =====

def add_deadline(case_id: int, date: str, description: str,
                 document_link: str = None, calculation_note: str = None,
                 time: str = None, location: str = None, starred: bool = False) -> dict:
    """Add a deadline to a case."""
    validate_date_format(date, "date")
    validate_time_format(time, "time")

    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO deadlines (case_id, date, time, location, description, document_link, calculation_note, starred)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, case_id, date, time, location, description, document_link, calculation_note, starred, created_at
        """, (case_id, date, time, location, description, document_link, calculation_note, starred))
        return serialize_row(dict(cur.fetchone()))


def get_upcoming_deadlines(limit: int = None, offset: int = None) -> dict:
    """Get upcoming deadlines."""
    conditions = ["d.date >= CURRENT_DATE"]
    params = []

    where_clause = f"WHERE {' AND '.join(conditions)}"

    with get_cursor() as cur:
        cur.execute(f"SELECT COUNT(*) as total FROM deadlines d {where_clause}", params)
        total = cur.fetchone()["total"]

        query = f"""
            SELECT d.id, d.case_id, c.case_name, c.short_name, d.date, d.time, d.location,
                   d.description, d.document_link, d.calculation_note, d.starred
            FROM deadlines d
            JOIN cases c ON d.case_id = c.id
            {where_clause}
            ORDER BY d.date
        """
        if limit:
            query += f" LIMIT {limit}"
        if offset:
            query += f" OFFSET {offset}"

        cur.execute(query, params)
        return {"deadlines": serialize_rows([dict(row) for row in cur.fetchall()]), "total": total}


def update_deadline(deadline_id: int, starred: bool = None) -> Optional[dict]:
    """Update deadline starred status."""
    updates = []
    params = []

    if starred is not None:
        updates.append("starred = %s")
        params.append(starred)

    if not updates:
        return None

    params.append(deadline_id)

    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE deadlines SET {', '.join(updates)}
            WHERE id = %s
            RETURNING id, case_id, date, time, location, description, document_link, calculation_note, starred
        """, params)
        row = cur.fetchone()
        return serialize_row(dict(row)) if row else None


def update_deadline_full(deadline_id: int, date: str = None, description: str = None,
                         document_link: str = None, calculation_note: str = None,
                         time: str = None, location: str = None,
                         starred: bool = None) -> Optional[dict]:
    """Update all deadline fields."""
    updates = []
    params = []

    if date is not None:
        validate_date_format(date, "date")
        updates.append("date = %s")
        params.append(date)

    if time is not None:
        validate_time_format(time, "time")
        updates.append("time = %s")
        params.append(time if time else None)

    if location is not None:
        updates.append("location = %s")
        params.append(location if location else None)

    if description is not None:
        updates.append("description = %s")
        params.append(description)

    if document_link is not None:
        updates.append("document_link = %s")
        params.append(document_link if document_link else None)

    if calculation_note is not None:
        updates.append("calculation_note = %s")
        params.append(calculation_note if calculation_note else None)

    if starred is not None:
        updates.append("starred = %s")
        params.append(starred)

    if not updates:
        return None

    params.append(deadline_id)

    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE deadlines SET {', '.join(updates)}
            WHERE id = %s
            RETURNING id, case_id, date, time, location, description, document_link, calculation_note, starred
        """, params)
        row = cur.fetchone()
        return serialize_row(dict(row)) if row else None


def delete_deadline(deadline_id: int) -> bool:
    """Delete a deadline."""
    with get_cursor() as cur:
        cur.execute("DELETE FROM deadlines WHERE id = %s", (deadline_id,))
        return cur.rowcount > 0


def search_deadlines(query: str = None, case_id: int = None,
                     limit: int = 50) -> List[dict]:
    """Search deadlines by various criteria."""
    conditions = []
    params = []

    if query:
        conditions.append("d.description ILIKE %s")
        params.append(f"%{query}%")

    if case_id:
        conditions.append("d.case_id = %s")
        params.append(case_id)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with get_cursor() as cur:
        cur.execute(f"""
            SELECT d.id, d.case_id, c.case_name, c.short_name, d.date, d.time, d.location,
                   d.description, d.starred
            FROM deadlines d
            JOIN cases c ON d.case_id = c.id
            {where_clause}
            ORDER BY d.date
            LIMIT %s
        """, params + [limit])
        return [dict(row) for row in cur.fetchall()]


# ===== NOTE OPERATIONS =====

def add_note(case_id: int, content: str) -> dict:
    """Add a note to a case."""
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO notes (case_id, content)
            VALUES (%s, %s)
            RETURNING id, case_id, content, created_at, updated_at
        """, (case_id, content))
        return serialize_row(dict(cur.fetchone()))


def update_note(note_id: int, content: str) -> Optional[dict]:
    """Update a note's content."""
    with get_cursor() as cur:
        cur.execute("""
            UPDATE notes SET content = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING id, case_id, content, created_at, updated_at
        """, (content, note_id))
        row = cur.fetchone()
        return serialize_row(dict(row)) if row else None


def delete_note(note_id: int) -> bool:
    """Delete a note."""
    with get_cursor() as cur:
        cur.execute("DELETE FROM notes WHERE id = %s", (note_id,))
        return cur.rowcount > 0


# ===== ACTIVITY OPERATIONS =====

def add_activity(case_id: int, description: str, activity_type: str,
                 date: str, minutes: int = None) -> dict:
    """Add an activity to a case."""
    validate_date_format(date, "date")

    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO activities (case_id, description, type, date, minutes)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, case_id, description, type, date, minutes, created_at
        """, (case_id, description, activity_type, date, minutes))
        return serialize_row(dict(cur.fetchone()))


def get_all_activities(case_id: int = None) -> List[dict]:
    """Get all activities, optionally filtered by case."""
    with get_cursor() as cur:
        if case_id:
            cur.execute("""
                SELECT a.id, a.case_id, c.case_name, a.description, a.type, a.date, a.minutes
                FROM activities a
                JOIN cases c ON a.case_id = c.id
                WHERE a.case_id = %s
                ORDER BY a.date DESC
            """, (case_id,))
        else:
            cur.execute("""
                SELECT a.id, a.case_id, c.case_name, a.description, a.type, a.date, a.minutes
                FROM activities a
                JOIN cases c ON a.case_id = c.id
                ORDER BY a.date DESC
            """)
        return [dict(row) for row in cur.fetchall()]


def update_activity(activity_id: int, date: str = None, description: str = None,
                    activity_type: str = None, minutes: int = None) -> Optional[dict]:
    """Update an activity."""
    updates = []
    params = []

    if date is not None:
        validate_date_format(date, "date")
        updates.append("date = %s")
        params.append(date)

    if description is not None:
        updates.append("description = %s")
        params.append(description)

    if activity_type is not None:
        updates.append("type = %s")
        params.append(activity_type)

    if minutes is not None:
        updates.append("minutes = %s")
        params.append(minutes)

    if not updates:
        return None

    params.append(activity_id)

    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE activities SET {', '.join(updates)}
            WHERE id = %s
            RETURNING id, case_id, description, type, date, minutes
        """, params)
        row = cur.fetchone()
        return serialize_row(dict(row)) if row else None


def delete_activity(activity_id: int) -> bool:
    """Delete an activity."""
    with get_cursor() as cur:
        cur.execute("DELETE FROM activities WHERE id = %s", (activity_id,))
        return cur.rowcount > 0


# ===== CALENDAR OPERATIONS =====

def get_calendar(days: int = 30, include_tasks: bool = True,
                 include_deadlines: bool = True) -> List[dict]:
    """Get calendar items for the next N days."""
    items = []

    with get_cursor() as cur:
        if include_deadlines:
            cur.execute("""
                SELECT d.id, d.date, d.time, d.location, d.description,
                       d.case_id, c.case_name, c.short_name, 'deadline' as item_type
                FROM deadlines d
                JOIN cases c ON d.case_id = c.id
                WHERE d.date >= CURRENT_DATE AND d.date <= CURRENT_DATE + %s
                ORDER BY d.date, d.time NULLS LAST
            """, (days,))
            items.extend([dict(row) for row in cur.fetchall()])

        if include_tasks:
            cur.execute("""
                SELECT t.id, t.due_date as date, NULL as time, NULL as location,
                       t.description, t.status, t.urgency,
                       t.case_id, c.case_name, c.short_name, 'task' as item_type
                FROM tasks t
                JOIN cases c ON t.case_id = c.id
                WHERE t.due_date IS NOT NULL
                  AND t.due_date >= CURRENT_DATE AND t.due_date <= CURRENT_DATE + %s
                  AND t.status != 'Done'
                ORDER BY t.due_date
            """, (days,))
            items.extend([dict(row) for row in cur.fetchall()])

    # Sort by date
    items.sort(key=lambda x: (str(x.get("date") or "9999-99-99"), str(x.get("time") or "99:99")))
    return items


# ===== DASHBOARD STATS =====

def get_dashboard_stats() -> dict:
    """Get dashboard statistics."""
    with get_cursor() as cur:
        # Total cases
        cur.execute("SELECT COUNT(*) as total FROM cases")
        total_cases = cur.fetchone()["total"]

        # Active cases (not Closed or Settl. Pend.)
        cur.execute("""
            SELECT COUNT(*) as active FROM cases
            WHERE status NOT IN ('Closed', 'Settl. Pend.')
        """)
        active_cases = cur.fetchone()["active"]

        # Pending tasks
        cur.execute("SELECT COUNT(*) as pending FROM tasks WHERE status = 'Pending'")
        pending_tasks = cur.fetchone()["pending"]

        # Upcoming deadlines (next 30 days)
        cur.execute("""
            SELECT COUNT(*) as upcoming FROM deadlines
            WHERE date >= CURRENT_DATE AND date <= CURRENT_DATE + 30
        """)
        upcoming_deadlines = cur.fetchone()["upcoming"]

        # Cases by status
        cur.execute("""
            SELECT status, COUNT(*) as count FROM cases
            GROUP BY status ORDER BY count DESC
        """)
        cases_by_status = {row["status"]: row["count"] for row in cur.fetchall()}

        return {
            "total_cases": total_cases,
            "active_cases": active_cases,
            "pending_tasks": pending_tasks,
            "upcoming_deadlines": upcoming_deadlines,
            "cases_by_status": cases_by_status
        }
