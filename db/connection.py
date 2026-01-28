"""
Database connection pooling, initialization, and migrations.
"""

import os
import atexit
import psycopg2
from psycopg2.pool import ThreadedConnectionPool
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from datetime import datetime, date, time

from .validation import (
    DEFAULT_JURISDICTIONS, DEFAULT_EXPERTISE_TYPES, DEFAULT_PERSON_TYPES
)

DATABASE_URL = os.environ.get("DATABASE_URL")

# Connection pool configuration
DB_POOL_MIN = int(os.environ.get("DB_POOL_MIN", 2))
DB_POOL_MAX = int(os.environ.get("DB_POOL_MAX", 10))

# Global connection pool
_pool: ThreadedConnectionPool | None = None

# Sentinel value to distinguish "not provided" from "explicitly set to None/null"
_NOT_PROVIDED = object()


def get_pool() -> ThreadedConnectionPool:
    """Get or create the database connection pool."""
    global _pool
    if _pool is None:
        _pool = ThreadedConnectionPool(
            minconn=DB_POOL_MIN,
            maxconn=DB_POOL_MAX,
            dsn=DATABASE_URL
        )
    return _pool


def close_pool():
    """Close the connection pool. Called on process shutdown."""
    global _pool
    if _pool is not None:
        _pool.closeall()
        _pool = None


# Register cleanup on process exit
atexit.register(close_pool)


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


@contextmanager
def get_connection():
    """Context manager for database connections from the pool."""
    pool = get_pool()
    conn = pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


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
            DROP TABLE IF EXISTS webhook_logs CASCADE;
            DROP TABLE IF EXISTS notes CASCADE;
            DROP TABLE IF EXISTS tasks CASCADE;
            DROP TABLE IF EXISTS events CASCADE;
            DROP TABLE IF EXISTS deadlines CASCADE;
            DROP TABLE IF EXISTS activities CASCADE;
            DROP TABLE IF EXISTS judges CASCADE;
            DROP TABLE IF EXISTS proceedings CASCADE;
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
            # Check if old 'court' column exists before trying to migrate from it
            cur.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.columns
                    WHERE table_name = 'cases' AND column_name = 'court'
                )
            """)
            if cur.fetchone()[0]:
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

        # 3. Remove court_id column from cases (court is now only through proceedings)
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_name = 'cases' AND column_name = 'court_id'
            )
        """)
        if cur.fetchone()[0]:
            cur.execute("DROP INDEX IF EXISTS idx_cases_court_id")
            cur.execute("ALTER TABLE cases DROP COLUMN court_id")
            print("  - Removed court_id column from cases (now managed through proceedings)")

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

        # 10. Add time and location columns to deadlines/events if they don't exist
        # Check if deadlines table still exists (not yet renamed to events)
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'deadlines'
            )
        """)
        deadlines_table_exists = cur.fetchone()[0]

        if deadlines_table_exists:
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
        # Check if deadlines table still exists (not yet renamed to events)
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'deadlines'
            )
        """)
        if cur.fetchone()[0]:
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
        # Check if deadlines table still exists (not yet renamed to events)
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'deadlines'
            )
        """)
        if cur.fetchone()[0]:
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

        # 19. Add sort_order column to tasks if it doesn't exist
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_name = 'tasks' AND column_name = 'sort_order'
            )
        """)
        if not cur.fetchone()[0]:
            cur.execute("ALTER TABLE tasks ADD COLUMN sort_order INTEGER DEFAULT 0")
            # Initialize sort_order for existing tasks: sort_order = id * 1000
            cur.execute("UPDATE tasks SET sort_order = id * 1000 WHERE sort_order = 0 OR sort_order IS NULL")
            print("  - Added sort_order column to tasks")

        # 17. Migrate urgency from 1-5 scale to 1-4 scale (Low, Medium, High, Urgent)
        # First check if any tasks have urgency=5 (indicating we haven't migrated yet)
        cur.execute("SELECT COUNT(*) FROM tasks WHERE urgency = 5")
        if cur.fetchone()[0] > 0:
            # Convert urgency=5 to urgency=4
            cur.execute("UPDATE tasks SET urgency = 4 WHERE urgency = 5")
            print("  - Migrated urgency=5 tasks to urgency=4")

        # Check and update the CHECK constraint on urgency column
        cur.execute("""
            SELECT constraint_name
            FROM information_schema.check_constraints
            WHERE constraint_name LIKE 'tasks_urgency_check%'
        """)
        old_constraint = cur.fetchone()
        if old_constraint:
            # Check if the current constraint allows 5 (needs migration)
            cur.execute("""
                SELECT check_clause
                FROM information_schema.check_constraints
                WHERE constraint_name = %s
            """, (old_constraint[0],))
            check_clause = cur.fetchone()
            if check_clause and '5' in check_clause[0]:
                # Drop old constraint and add new one
                cur.execute(f"ALTER TABLE tasks DROP CONSTRAINT {old_constraint[0]}")
                cur.execute("ALTER TABLE tasks ADD CONSTRAINT tasks_urgency_check CHECK (urgency >= 1 AND urgency <= 4)")
                print("  - Updated urgency constraint from 1-5 to 1-4")

        # 20. Rename deadlines table to events
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'deadlines'
            )
        """)
        if cur.fetchone()[0]:
            # Rename the table
            cur.execute("ALTER TABLE deadlines RENAME TO events")
            print("  - Renamed deadlines table to events")

            # Rename the foreign key column in tasks
            cur.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.columns
                    WHERE table_name = 'tasks' AND column_name = 'deadline_id'
                )
            """)
            if cur.fetchone()[0]:
                cur.execute("ALTER TABLE tasks RENAME COLUMN deadline_id TO event_id")
                print("  - Renamed deadline_id column to event_id in tasks table")

            # Rename indexes
            cur.execute("""
                SELECT indexname FROM pg_indexes
                WHERE tablename = 'events' AND indexname LIKE 'idx_deadlines%'
            """)
            for row in cur.fetchall():
                old_name = row[0]
                new_name = old_name.replace('deadlines', 'events')
                cur.execute(f"ALTER INDEX {old_name} RENAME TO {new_name}")
                print(f"  - Renamed index {old_name} to {new_name}")

        # 21. Create proceedings table if it doesn't exist
        cur.execute("""
            CREATE TABLE IF NOT EXISTS proceedings (
                id SERIAL PRIMARY KEY,
                case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
                case_number VARCHAR(100) NOT NULL,
                jurisdiction_id INTEGER REFERENCES jurisdictions(id),
                sort_order INTEGER DEFAULT 0,
                is_primary BOOLEAN DEFAULT FALSE,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_proceedings_case_id ON proceedings(case_id)")
        print("  - Created proceedings table (if not exists)")

        # 22. Rename proceeding_judges to judges if it exists (migration from old name)
        #     Only rename if proceeding_judges exists AND judges does NOT exist
        cur.execute("""
            SELECT
                EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'proceeding_judges') as has_old,
                EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'judges') as has_new
        """)
        row = cur.fetchone()
        if row[0] and not row[1]:  # has old table, no new table
            cur.execute("ALTER TABLE proceeding_judges RENAME TO judges")
            cur.execute("ALTER INDEX IF EXISTS idx_proceeding_judges_proceeding_id RENAME TO idx_judges_proceeding_id")
            cur.execute("ALTER INDEX IF EXISTS idx_proceeding_judges_person_id RENAME TO idx_judges_person_id")
            print("  - Renamed proceeding_judges table to judges")
        elif row[0] and row[1]:  # both exist - migrate data and drop old
            cur.execute("""
                INSERT INTO judges (proceeding_id, person_id, role, sort_order, created_at)
                SELECT proceeding_id, person_id, role, sort_order, created_at
                FROM proceeding_judges
                ON CONFLICT (proceeding_id, person_id) DO NOTHING
            """)
            cur.execute("DROP TABLE proceeding_judges")
            print("  - Migrated data from proceeding_judges to judges and dropped old table")

        # 23. Create judges junction table for multi-judge support (if not exists)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS judges (
                id SERIAL PRIMARY KEY,
                proceeding_id INTEGER NOT NULL REFERENCES proceedings(id) ON DELETE CASCADE,
                person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
                role VARCHAR(50) DEFAULT 'Judge',
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(proceeding_id, person_id)
            )
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_judges_proceeding_id ON judges(proceeding_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_judges_person_id ON judges(person_id)")
        print("  - Created judges table (if not exists)")

        # Migrate existing judge_id data from proceedings to judges
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_name = 'proceedings' AND column_name = 'judge_id'
            ) as has_judge_id
        """)
        if cur.fetchone()[0]:
            # Migrate existing judge_id data to judges
            cur.execute("""
                INSERT INTO judges (proceeding_id, person_id, role, sort_order)
                SELECT id, judge_id, 'Judge', 0
                FROM proceedings
                WHERE judge_id IS NOT NULL
                  AND NOT EXISTS (
                    SELECT 1 FROM judges pj
                    WHERE pj.proceeding_id = proceedings.id
                      AND pj.person_id = proceedings.judge_id
                  )
            """)
            # Drop the old judge_id column
            cur.execute("ALTER TABLE proceedings DROP COLUMN IF EXISTS judge_id")
            print("  - Migrated judge_id to judges and dropped column")

        # 24. Standardize "Magistrate" role to "Magistrate Judge" in judges table
        cur.execute("UPDATE judges SET role = 'Magistrate Judge' WHERE role = 'Magistrate'")

        # 25. Remove any judge roles from case_persons (judges belong on proceedings only)
        cur.execute("DELETE FROM case_persons WHERE role IN ('Judge', 'Magistrate Judge')")

        # 26. Add docket_category column to tasks for Daily Docket scheduling
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_name = 'tasks' AND column_name = 'docket_category'
            )
        """)
        if not cur.fetchone()[0]:
            cur.execute("ALTER TABLE tasks ADD COLUMN docket_category VARCHAR(20)")
            print("  - Added docket_category column to tasks")

        # 27. Add docket_order column to tasks for sorting within Daily Docket
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_name = 'tasks' AND column_name = 'docket_order'
            )
        """)
        if not cur.fetchone()[0]:
            cur.execute("ALTER TABLE tasks ADD COLUMN docket_order INTEGER")
            print("  - Added docket_order column to tasks")

        # 28. Create webhook_logs table for storing incoming webhooks
        cur.execute("""
            CREATE TABLE IF NOT EXISTS webhook_logs (
                id SERIAL PRIMARY KEY,
                source VARCHAR(50) NOT NULL,
                event_type VARCHAR(100),
                idempotency_key UUID UNIQUE,
                payload JSONB NOT NULL DEFAULT '{}',
                headers JSONB DEFAULT '{}',
                proceeding_id INTEGER REFERENCES proceedings(id) ON DELETE SET NULL,
                task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
                event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
                processing_status VARCHAR(20) NOT NULL DEFAULT 'pending',
                processing_error TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                processed_at TIMESTAMP
            )
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_webhook_logs_source ON webhook_logs(source)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(processing_status)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_webhook_logs_proceeding_id ON webhook_logs(proceeding_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_webhook_logs_idempotency_key ON webhook_logs(idempotency_key)")
        print("  - Created webhook_logs table (if not exists)")

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

        # 8. Events table (calendar events: hearings, depositions, filing deadlines, etc.)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS events (
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
                event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
                due_date DATE,
                completion_date DATE,
                description TEXT NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'Pending',
                urgency INTEGER CHECK (urgency >= 1 AND urgency <= 4) DEFAULT 2,
                sort_order INTEGER DEFAULT 0,
                docket_category VARCHAR(20),
                docket_order INTEGER,
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

        # 11. Proceedings table (court filings within a case)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS proceedings (
                id SERIAL PRIMARY KEY,
                case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
                case_number VARCHAR(100) NOT NULL,
                jurisdiction_id INTEGER REFERENCES jurisdictions(id),
                sort_order INTEGER DEFAULT 0,
                is_primary BOOLEAN DEFAULT FALSE,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 12. Proceeding judges junction table (multi-judge support)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS judges (
                id SERIAL PRIMARY KEY,
                proceeding_id INTEGER NOT NULL REFERENCES proceedings(id) ON DELETE CASCADE,
                person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
                role VARCHAR(50) DEFAULT 'Judge',
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(proceeding_id, person_id)
            )
        """)

        # 13. Webhook logs table (for storing incoming webhooks from external services)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS webhook_logs (
                id SERIAL PRIMARY KEY,
                source VARCHAR(50) NOT NULL,
                event_type VARCHAR(100),
                idempotency_key UUID UNIQUE,
                payload JSONB NOT NULL DEFAULT '{}',
                headers JSONB DEFAULT '{}',
                proceeding_id INTEGER REFERENCES proceedings(id) ON DELETE SET NULL,
                task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
                event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
                processing_status VARCHAR(20) NOT NULL DEFAULT 'pending',
                processing_error TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                processed_at TIMESTAMP
            )
        """)

        # Create indexes for better query performance
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
            CREATE INDEX IF NOT EXISTS idx_persons_name ON persons(name);
            CREATE INDEX IF NOT EXISTS idx_persons_type ON persons(person_type);
            CREATE INDEX IF NOT EXISTS idx_persons_archived ON persons(archived);
            CREATE INDEX IF NOT EXISTS idx_persons_attributes ON persons USING GIN (attributes);
            CREATE INDEX IF NOT EXISTS idx_case_persons_case_id ON case_persons(case_id);
            CREATE INDEX IF NOT EXISTS idx_case_persons_person_id ON case_persons(person_id);
            CREATE INDEX IF NOT EXISTS idx_case_persons_role ON case_persons(role);
            CREATE INDEX IF NOT EXISTS idx_tasks_case_id ON tasks(case_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
            CREATE INDEX IF NOT EXISTS idx_tasks_sort_order ON tasks(sort_order);
            CREATE INDEX IF NOT EXISTS idx_events_case_id ON events(case_id);
            CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
            CREATE INDEX IF NOT EXISTS idx_activities_case_id ON activities(case_id);
            CREATE INDEX IF NOT EXISTS idx_notes_case_id ON notes(case_id);
            CREATE INDEX IF NOT EXISTS idx_proceedings_case_id ON proceedings(case_id);
            CREATE INDEX IF NOT EXISTS idx_judges_proceeding_id ON judges(proceeding_id);
            CREATE INDEX IF NOT EXISTS idx_judges_person_id ON judges(person_id);
            CREATE INDEX IF NOT EXISTS idx_webhook_logs_source ON webhook_logs(source);
            CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(processing_status);
            CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at);
            CREATE INDEX IF NOT EXISTS idx_webhook_logs_proceeding_id ON webhook_logs(proceeding_id);
            CREATE INDEX IF NOT EXISTS idx_webhook_logs_idempotency_key ON webhook_logs(idempotency_key);
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
