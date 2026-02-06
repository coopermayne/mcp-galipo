"""
Database connection pooling, initialization, and migrations.
"""

import os
import atexit
import psycopg2
from pathlib import Path
from psycopg2.pool import ThreadedConnectionPool
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from datetime import datetime, date, time

from .validation import DEFAULT_JURISDICTIONS, DEFAULT_EXPERTISE_TYPES

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
        if not DATABASE_URL:
            raise RuntimeError(
                "DATABASE_URL environment variable is not set. "
                "Make sure to export it: set -a && source .env && set +a"
            )
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
            DROP TABLE IF EXISTS schema_migrations CASCADE;
            DROP TABLE IF EXISTS proceeding_judges CASCADE;
            DROP TABLE IF EXISTS proceedings CASCADE;
            DROP TABLE IF EXISTS notes CASCADE;
            DROP TABLE IF EXISTS tasks CASCADE;
            DROP TABLE IF EXISTS events CASCADE;
            DROP TABLE IF EXISTS activities CASCADE;
            DROP TABLE IF EXISTS person_roles CASCADE;
            DROP TABLE IF EXISTS expertise_types CASCADE;
            DROP TABLE IF EXISTS roles CASCADE;
            DROP TABLE IF EXISTS judges CASCADE;
            DROP TABLE IF EXISTS persons CASCADE;
            DROP TABLE IF EXISTS users CASCADE;
            DROP TABLE IF EXISTS cases CASCADE;
            DROP TABLE IF EXISTS jurisdictions CASCADE;
        """)
    print("All tables dropped.")


def migrate_db():
    """Run any pending SQL migrations from the migrations/ folder.

    This is the only migration mechanism. All schema changes go through
    numbered .sql files in the migrations/ directory.
    """
    with get_cursor(dict_cursor=False) as cur:
        # Check if we have any tables at all
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'cases'
            )
        """)
        if not cur.fetchone()[0]:
            print("No existing tables found, skipping migrations.")
            return

        print("Checking for pending migrations...")
        run_sql_migrations(cur)
        print("Migration check complete.")


def run_sql_migrations(cur):
    """Run SQL migration files from the migrations/ folder.

    Tracks which migrations have been run in a schema_migrations table.
    Migration files should be named with a numeric prefix for ordering
    (e.g., 001_add_foo_column.sql).
    """
    cur.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id SERIAL PRIMARY KEY,
            filename VARCHAR(255) NOT NULL UNIQUE,
            applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cur.execute("SELECT filename FROM schema_migrations")
    applied = {row[0] for row in cur.fetchall()}

    migrations_dir = Path(__file__).parent.parent / "migrations"
    if not migrations_dir.exists():
        return

    sql_files = sorted(migrations_dir.glob("*.sql"))

    for sql_file in sql_files:
        filename = sql_file.name
        if filename in applied:
            continue

        print(f"  - Running migration: {filename}")
        try:
            sql_content = sql_file.read_text()
            cur.execute(sql_content)
            cur.execute(
                "INSERT INTO schema_migrations (filename) VALUES (%s)",
                (filename,)
            )
            print(f"    ✓ {filename} applied successfully")
        except Exception as e:
            print(f"    ✗ {filename} failed: {e}")
            raise


def init_db():
    """Create all tables if they don't exist.

    This is the single source of truth for the database schema.
    Tables are created in dependency order (parents before children).
    """
    with get_cursor(dict_cursor=False) as cur:
        # ── Independent tables (no foreign keys) ──────────────────────

        # 1. Jurisdictions
        cur.execute("""
            CREATE TABLE IF NOT EXISTS jurisdictions (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                long_name VARCHAR(255),
                local_rules_link TEXT,
                notes TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 2. Cases
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
                color VARCHAR(20),
                attorney_ids INTEGER[] DEFAULT '{}',
                paralegal_ids INTEGER[] DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 3. Persons
        cur.execute("""
            CREATE TABLE IF NOT EXISTS persons (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                phones JSONB DEFAULT '[]',
                emails JSONB DEFAULT '[]',
                address TEXT,
                organization VARCHAR(255),
                notes TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                archived BOOLEAN DEFAULT FALSE
            )
        """)

        # 4. Roles
        cur.execute("""
            CREATE TABLE IF NOT EXISTS roles (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                category VARCHAR(50) NOT NULL CHECK (
                    category IN ('client', 'counsel', 'defendant', 'expert', 'mediator', 'other')
                ),
                sort_order INTEGER DEFAULT 0,
                description TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 5. Expertise types
        cur.execute("""
            CREATE TABLE IF NOT EXISTS expertise_types (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                description TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 6. Users
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                initials VARCHAR(10) NOT NULL,
                bar_number VARCHAR(50),
                position VARCHAR(50) NOT NULL,
                is_admin BOOLEAN DEFAULT FALSE,
                must_change_password BOOLEAN DEFAULT TRUE,
                is_active BOOLEAN DEFAULT TRUE,
                paralegal_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ── Tables with single-parent foreign keys ────────────────────

        # 7. Person roles (persons + roles + cases)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS person_roles (
                id SERIAL PRIMARY KEY,
                person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
                role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
                case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
                attributes JSONB DEFAULT '{}',
                notes TEXT,
                is_primary BOOLEAN NOT NULL DEFAULT FALSE,
                grouped_under_id INTEGER REFERENCES persons(id) ON DELETE SET NULL,
                assigned_date DATE,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 8. Judges (standalone entity, linked to jurisdictions)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS judges (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                phones JSONB DEFAULT '[]',
                emails JSONB DEFAULT '[]',
                jurisdiction_id INTEGER REFERENCES jurisdictions(id) ON DELETE SET NULL,
                chambers TEXT,
                courtroom_number VARCHAR(50),
                appointed_by VARCHAR(255),
                appointed_date DATE,
                initials VARCHAR(10),
                status VARCHAR(50) DEFAULT 'Active',
                notes TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 9. Proceedings (cases + jurisdictions)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS proceedings (
                id SERIAL PRIMARY KEY,
                case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
                case_number VARCHAR(100) NOT NULL,
                jurisdiction_id INTEGER REFERENCES jurisdictions(id),
                sort_order INTEGER DEFAULT 0,
                is_primary BOOLEAN DEFAULT FALSE,
                notes TEXT,
                courtlistener_docket_id BIGINT,
                pacer_case_id VARCHAR(100),
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 10. Proceeding judges (proceedings + judges)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS proceeding_judges (
                id SERIAL PRIMARY KEY,
                proceeding_id INTEGER NOT NULL REFERENCES proceedings(id) ON DELETE CASCADE,
                judge_id INTEGER NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
                role VARCHAR(50) DEFAULT 'Judge',
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(proceeding_id, judge_id)
            )
        """)

        # 11. Activities
        cur.execute("""
            CREATE TABLE IF NOT EXISTS activities (
                id SERIAL PRIMARY KEY,
                case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
                date DATE NOT NULL,
                description TEXT NOT NULL,
                type VARCHAR(50) NOT NULL,
                minutes INTEGER,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 12. Events
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
                attendee_ids INTEGER[] DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 13. Tasks (depends on cases, events, users)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
                event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
                due_date DATE,
                completion_date DATE,
                description TEXT NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'Pending',
                urgency VARCHAR(20) NOT NULL DEFAULT 'Medium'
                    CHECK (urgency IN ('Low', 'Medium', 'High', 'Urgent')),
                sort_order INTEGER DEFAULT 0,
                assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 14. Notes
        cur.execute("""
            CREATE TABLE IF NOT EXISTS notes (
                id SERIAL PRIMARY KEY,
                case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
                content TEXT NOT NULL,
                starred BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 15. Webhook logs
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
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                processed_at TIMESTAMPTZ
            )
        """)

        # 16. Schema migrations tracking
        cur.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL UNIQUE,
                applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ── Indexes ───────────────────────────────────────────────────

        cur.execute("""
            -- Cases
            CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
            CREATE INDEX IF NOT EXISTS idx_cases_attorney_ids ON cases USING GIN(attorney_ids);
            CREATE INDEX IF NOT EXISTS idx_cases_paralegal_ids ON cases USING GIN(paralegal_ids);

            -- Persons
            CREATE INDEX IF NOT EXISTS idx_persons_name ON persons(name);
            CREATE INDEX IF NOT EXISTS idx_persons_archived ON persons(archived);

            -- Roles
            CREATE INDEX IF NOT EXISTS idx_roles_category ON roles(category);
            CREATE INDEX IF NOT EXISTS idx_roles_sort_order ON roles(sort_order);

            -- Person roles
            CREATE INDEX IF NOT EXISTS idx_person_roles_person_id ON person_roles(person_id);
            CREATE INDEX IF NOT EXISTS idx_person_roles_role_id ON person_roles(role_id);
            CREATE INDEX IF NOT EXISTS idx_person_roles_case_id ON person_roles(case_id);

            -- Users
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
            CREATE INDEX IF NOT EXISTS idx_users_paralegal_id ON users(paralegal_id);

            -- Judges
            CREATE INDEX IF NOT EXISTS idx_judges_name ON judges(name);
            CREATE INDEX IF NOT EXISTS idx_judges_jurisdiction_id ON judges(jurisdiction_id);
            CREATE INDEX IF NOT EXISTS idx_judges_status ON judges(status);

            -- Proceeding judges
            CREATE INDEX IF NOT EXISTS idx_proceeding_judges_proceeding_id ON proceeding_judges(proceeding_id);
            CREATE INDEX IF NOT EXISTS idx_proceeding_judges_judge_id ON proceeding_judges(judge_id);

            -- Proceedings
            CREATE INDEX IF NOT EXISTS idx_proceedings_case_id ON proceedings(case_id);

            -- Activities
            CREATE INDEX IF NOT EXISTS idx_activities_case_id ON activities(case_id);

            -- Events
            CREATE INDEX IF NOT EXISTS idx_events_case_id ON events(case_id);
            CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
            CREATE INDEX IF NOT EXISTS idx_events_attendee_ids ON events USING GIN(attendee_ids);

            -- Tasks
            CREATE INDEX IF NOT EXISTS idx_tasks_case_id ON tasks(case_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
            CREATE INDEX IF NOT EXISTS idx_tasks_sort_order ON tasks(sort_order);
            CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);

            -- Notes
            CREATE INDEX IF NOT EXISTS idx_notes_case_id ON notes(case_id);

            -- Webhook logs
            CREATE INDEX IF NOT EXISTS idx_webhook_logs_source ON webhook_logs(source);
            CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(processing_status);
            CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at);
            CREATE INDEX IF NOT EXISTS idx_webhook_logs_proceeding_id ON webhook_logs(proceeding_id);
            CREATE INDEX IF NOT EXISTS idx_webhook_logs_idempotency_key ON webhook_logs(idempotency_key);
        """)

        # ── Partial unique indexes (business rules) ──────────────────

        # One person can only have one instance of a role per case
        cur.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_person_roles_case
                ON person_roles(person_id, role_id, case_id)
                WHERE case_id IS NOT NULL
        """)

        # One person can only have one instance of a standalone (non-case) role
        cur.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_person_roles_standalone
                ON person_roles(person_id, role_id)
                WHERE case_id IS NULL
        """)

        # Only one proceeding per case can be primary
        cur.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_proceedings_primary_per_case
                ON proceedings(case_id)
                WHERE is_primary = TRUE
        """)

        # Partial indexes for CourtListener/PACER lookups
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_proceedings_courtlistener_docket_id
                ON proceedings(courtlistener_docket_id)
                WHERE courtlistener_docket_id IS NOT NULL
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_proceedings_pacer_case_id
                ON proceedings(pacer_case_id)
                WHERE pacer_case_id IS NOT NULL
        """)

        # Unique constraint: one case per jurisdiction (case_id + jurisdiction combo)
        cur.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_proceedings_case_jurisdiction
                ON proceedings(case_id, jurisdiction_id)
        """)

    print("Database tables initialized.")


def seed_admin_user():
    """Seed the admin user for production. Idempotent (ON CONFLICT DO NOTHING)."""
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO users (email, password_hash, first_name, last_name, initials,
                               bar_number, position, is_admin, must_change_password)
            VALUES (
                'cmayne@galipolaw.com',
                '$2b$12$RIH.48YzoKP8OWUh6hOxLORtkaHd2.9WqKKCzpv4cbUZaXODHA/N2',
                'Cooper',
                'Mayne',
                'CM',
                '343691',
                'attorney',
                TRUE,
                TRUE
            )
            ON CONFLICT (email) DO NOTHING
        """)


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


def seed_roles():
    """Seed initial roles if the table is empty.

    Roles are seeded from DEFAULT_ROLES in validation.py.
    """
    from .validation import DEFAULT_ROLES
    with get_cursor() as cur:
        cur.execute("SELECT COUNT(*) as count FROM roles")
        if cur.fetchone()["count"] > 0:
            return  # Already seeded

        for role in DEFAULT_ROLES:
            cur.execute("""
                INSERT INTO roles (name, category, sort_order)
                VALUES (%s, %s, %s)
                ON CONFLICT (name) DO NOTHING
            """, (role["name"], role["category"], role["sort_order"]))
    print(f"Seeded {len(DEFAULT_ROLES)} roles.")


def seed_db():
    """Seed all lookup tables and users."""
    seed_admin_user()
    seed_jurisdictions()
    seed_expertise_types()
    seed_roles()
    print("Database seeded with lookup data.")

    # Seed dev users if in a verified dev environment
    # This is safe: only runs on localhost + galipo_2/galipo_3 databases
    from .dev_users import seed_dev_users
    seed_dev_users()
