"""
Database module for PostgreSQL connection and operations.

Uses DATABASE_URL environment variable (provided by Coolify).
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager

DATABASE_URL = os.environ.get("DATABASE_URL")


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


def init_db():
    """Create tables if they don't exist."""
    with get_cursor(dict_cursor=False) as cur:
        # Cases table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS cases (
                id SERIAL PRIMARY KEY,
                case_name VARCHAR(255) UNIQUE NOT NULL,
                case_number VARCHAR(50) NOT NULL,
                client_name VARCHAR(255) NOT NULL,
                status VARCHAR(50) NOT NULL,
                court VARCHAR(255)
            )
        """)

        # Activities table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS activities (
                id SERIAL PRIMARY KEY,
                case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
                date DATE NOT NULL,
                description TEXT NOT NULL,
                type VARCHAR(50) NOT NULL,
                minutes INTEGER
            )
        """)

        # Deadlines table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS deadlines (
                id SERIAL PRIMARY KEY,
                case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
                date DATE NOT NULL,
                description TEXT NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'Pending'
            )
        """)

    print("Database tables initialized.")


def seed_db():
    """Insert mock data if tables are empty."""
    with get_cursor() as cur:
        # Check if cases table is empty
        cur.execute("SELECT COUNT(*) as count FROM cases")
        result = cur.fetchone()
        if result["count"] > 0:
            print("Database already seeded.")
            return

    # Mock data to seed
    cases_data = [
        {
            "case_name": "Smith v. Johnson",
            "case_number": "2024-CV-1234",
            "client_name": "Robert Smith",
            "status": "Active",
            "court": "Superior Court of California, Los Angeles County",
            "activities": [
                {"date": "2024-01-15", "description": "Initial client consultation", "type": "Meeting", "minutes": 60},
                {"date": "2024-02-01", "description": "Filed complaint", "type": "Filing", "minutes": 120},
                {"date": "2024-02-20", "description": "Received defendant's answer", "type": "Document Review", "minutes": 45},
            ],
            "deadlines": [
                {"date": "2024-03-15", "description": "Discovery requests due", "status": "Pending"},
                {"date": "2024-04-30", "description": "Deposition of defendant", "status": "Pending"},
            ],
        },
        {
            "case_name": "Estate of Williams",
            "case_number": "2024-PR-5678",
            "client_name": "Sarah Williams",
            "status": "Active",
            "court": "Probate Court, Cook County, Illinois",
            "activities": [
                {"date": "2024-01-20", "description": "Met with executor", "type": "Meeting", "minutes": 90},
                {"date": "2024-02-05", "description": "Filed petition for probate", "type": "Filing", "minutes": 180},
            ],
            "deadlines": [
                {"date": "2024-03-20", "description": "Creditor claims deadline", "status": "Pending"},
            ],
        },
        {
            "case_name": "Acme Corp Acquisition",
            "case_number": "2024-MA-9012",
            "client_name": "Acme Corporation",
            "status": "Pending Review",
            "court": "N/A - Transactional",
            "activities": [
                {"date": "2024-02-10", "description": "Due diligence kickoff call", "type": "Meeting", "minutes": 120},
                {"date": "2024-02-15", "description": "Reviewed target financials", "type": "Document Review", "minutes": 240},
                {"date": "2024-02-22", "description": "Drafted letter of intent", "type": "Drafting", "minutes": 180},
            ],
            "deadlines": [
                {"date": "2024-03-01", "description": "LOI signature deadline", "status": "Pending"},
                {"date": "2024-04-15", "description": "Closing date target", "status": "Pending"},
            ],
        },
    ]

    with get_cursor() as cur:
        for case_data in cases_data:
            # Insert case
            cur.execute("""
                INSERT INTO cases (case_name, case_number, client_name, status, court)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
            """, (
                case_data["case_name"],
                case_data["case_number"],
                case_data["client_name"],
                case_data["status"],
                case_data["court"]
            ))
            case_id = cur.fetchone()["id"]

            # Insert activities
            for activity in case_data["activities"]:
                cur.execute("""
                    INSERT INTO activities (case_id, date, description, type, minutes)
                    VALUES (%s, %s, %s, %s, %s)
                """, (
                    case_id,
                    activity["date"],
                    activity["description"],
                    activity["type"],
                    activity.get("minutes")
                ))

            # Insert deadlines
            for deadline in case_data["deadlines"]:
                cur.execute("""
                    INSERT INTO deadlines (case_id, date, description, status)
                    VALUES (%s, %s, %s, %s)
                """, (
                    case_id,
                    deadline["date"],
                    deadline["description"],
                    deadline["status"]
                ))

    print("Database seeded with mock data.")


# Query helper functions

def get_all_cases():
    """Get all cases with name and status."""
    with get_cursor() as cur:
        cur.execute("SELECT case_name, status FROM cases ORDER BY case_name")
        return cur.fetchall()


def get_case_by_name(case_name: str):
    """Get full case details by name."""
    with get_cursor() as cur:
        # Get case
        cur.execute("""
            SELECT id, case_name, case_number, client_name, status, court
            FROM cases WHERE case_name = %s
        """, (case_name,))
        case = cur.fetchone()

        if not case:
            return None

        # Get activities
        cur.execute("""
            SELECT date, description, type, minutes
            FROM activities
            WHERE case_id = %s
            ORDER BY date
        """, (case["id"],))
        activities = cur.fetchall()

        # Get deadlines
        cur.execute("""
            SELECT date, description, status
            FROM deadlines
            WHERE case_id = %s
            ORDER BY date
        """, (case["id"],))
        deadlines = cur.fetchall()

        return {
            "case_name": case["case_name"],
            "case_number": case["case_number"],
            "client_name": case["client_name"],
            "status": case["status"],
            "court": case["court"],
            "activities": [
                {
                    "date": str(a["date"]),
                    "description": a["description"],
                    "type": a["type"],
                    "minutes": a["minutes"]
                } for a in activities
            ],
            "deadlines": [
                {
                    "date": str(d["date"]),
                    "description": d["description"],
                    "status": d["status"]
                } for d in deadlines
            ]
        }


def get_all_case_names():
    """Get list of all case names."""
    with get_cursor() as cur:
        cur.execute("SELECT case_name FROM cases ORDER BY case_name")
        return [row["case_name"] for row in cur.fetchall()]


def get_upcoming_deadlines(days_ahead: int = 14):
    """Get all deadlines sorted by date."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT c.case_name, d.date, d.description, d.status
            FROM deadlines d
            JOIN cases c ON d.case_id = c.id
            ORDER BY d.date
        """)
        deadlines = cur.fetchall()
        return [
            {
                "case_name": d["case_name"],
                "date": str(d["date"]),
                "description": d["description"],
                "status": d["status"]
            } for d in deadlines
        ]


def add_activity(case_name: str, description: str, activity_type: str, minutes: int = None, date: str = None):
    """Add a new activity to a case."""
    with get_cursor() as cur:
        # Get case id
        cur.execute("SELECT id FROM cases WHERE case_name = %s", (case_name,))
        case = cur.fetchone()

        if not case:
            return None

        # Insert activity
        cur.execute("""
            INSERT INTO activities (case_id, date, description, type, minutes)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, date
        """, (case["id"], date, description, activity_type, minutes))

        result = cur.fetchone()
        return {
            "date": str(result["date"]),
            "description": description,
            "type": activity_type,
            "minutes": minutes
        }
