"""
Development user seeding for Galipo.

Seeds all firm users with a standard dev password for local development.
SAFETY: Only runs on verified dev environments (multiple checks).

This module preserves existing relationships:
- Uses UPSERT (ON CONFLICT DO UPDATE) to keep user IDs stable
- All foreign keys to users.id (tasks, events, cases) remain valid
- Only updates profile/auth fields, not relationships
"""

import os
import bcrypt
from urllib.parse import urlparse
from .connection import get_cursor

# Bcrypt cost factor (matches db/users.py)
BCRYPT_COST = 12

# Standard dev password
DEV_PASSWORD = "home3232"

# All firm users to seed
DEV_USERS = [
    # Paralegals (created first for FK references)
    {"email": "slaurel@example.com", "first_name": "Santiago", "last_name": "Laurel", "initials": "SGL", "bar_number": None, "position": "paralegal", "is_admin": False},
    {"email": "dgilbert@example.com", "first_name": "Darci", "last_name": "Gilbert", "initials": "DG", "bar_number": None, "position": "paralegal", "is_admin": False},
    {"email": "ldeleon@example.com", "first_name": "Leslie", "last_name": "DeLeon", "initials": "LL", "bar_number": None, "position": "paralegal", "is_admin": False},
    {"email": "amonguia@example.com", "first_name": "Alejandro", "last_name": "Monguia", "initials": "AM", "bar_number": None, "position": "paralegal", "is_admin": False},
    {"email": "test.paralegal@example.com", "first_name": "Test", "last_name": "Paralegal", "initials": "TP", "bar_number": None, "position": "paralegal", "is_admin": False},

    # Attorneys
    {"email": "someone@example.com", "first_name": "Dale", "last_name": "Galipo", "initials": "DKG", "bar_number": "144074", "position": "attorney", "is_admin": False},
    {"email": "rvalentine@example.com", "first_name": "Renee", "last_name": "Valentine", "initials": "RVM", "bar_number": "281819", "position": "attorney", "is_admin": False, "paralegal_email": "dgilbert@example.com"},
    {"email": "evalenzuela@example.com", "first_name": "Eric", "last_name": "Valenzuela", "initials": "EV", "bar_number": "284500", "position": "attorney", "is_admin": False, "paralegal_email": "ldeleon@example.com"},
    {"email": "hlee@example.com", "first_name": "Hang", "last_name": "Lee", "initials": "HL", "bar_number": "293450", "position": "attorney", "is_admin": False, "paralegal_email": "slaurel@example.com"},
    {"email": "msincich@example.com", "first_name": "Marcel", "last_name": "Sincich", "initials": "MFS", "bar_number": "319508", "position": "attorney", "is_admin": False, "paralegal_email": "ldeleon@example.com"},
    {"email": "blevine@example.com", "first_name": "Ben", "last_name": "Levine", "initials": "BL", "bar_number": "342060", "position": "attorney", "is_admin": False, "paralegal_email": "slaurel@example.com"},
    {"email": "cmayne@example.com", "first_name": "Cooper", "last_name": "Mayne", "initials": "CM", "bar_number": "343169", "position": "attorney", "is_admin": True, "paralegal_email": "dgilbert@example.com"},
    {"email": "bjohnson@example.com", "first_name": "Brendan", "last_name": "Johnson", "initials": "BJ", "bar_number": None, "position": "attorney", "is_admin": False, "paralegal_email": "ldeleon@example.com"},

    # Manager
    {"email": "davegalipo@example.com", "first_name": "Dave", "last_name": "Galipo", "initials": "DG", "bar_number": None, "position": "manager", "is_admin": False},
]


def is_dev_environment() -> tuple[bool, str]:
    """
    Check if we're in a dev environment using multiple safety conditions.

    Returns (is_dev, reason) tuple.

    A dev environment must satisfy:
    1. DATABASE_URL contains 'galipo' (our database naming convention)
    2. AND database host is localhost/127.0.0.1 (not a remote/cloud database)

    This ensures we only seed dev users on local databases, never on
    remote/cloud databases (Railway, Heroku, etc.) which would be production.
    """
    db_url = os.environ.get("DATABASE_URL", "")

    if not db_url:
        return False, "DATABASE_URL not set"

    # Check 1: Database name contains "galipo"
    is_galipo_db = "galipo" in db_url.lower()
    if not is_galipo_db:
        return False, f"Database name doesn't contain 'galipo'"

    # Check 2: Must be localhost (not cloud/production)
    try:
        parsed = urlparse(db_url)
        host = parsed.hostname or ""
        is_localhost = host in ("localhost", "127.0.0.1", "")
        if not is_localhost:
            return False, f"Database host '{host}' is not localhost"
    except Exception as e:
        return False, f"Could not parse DATABASE_URL: {e}"

    return True, "Dev environment detected (localhost + dev database name)"


def _hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(BCRYPT_COST)).decode('utf-8')


def seed_dev_users() -> bool:
    """
    Seed dev users if in a verified dev environment.

    SAFETY FEATURES:
    - Only runs if is_dev_environment() returns True
    - Uses UPSERT to preserve user IDs (keeps FK relationships intact)
    - Does NOT delete any existing users
    - Does NOT modify users not in our list

    RELATIONSHIP PRESERVATION:
    - Uses ON CONFLICT (email) DO UPDATE which keeps the same user.id
    - All foreign keys pointing to users (tasks.assignee_id, events.attendee_ids,
      cases.attorney_ids, cases.paralegal_ids) remain valid
    - Only updates: password, name, initials, bar_number, position, must_change_password

    Returns True if users were seeded, False if skipped.
    """
    is_dev, reason = is_dev_environment()

    if not is_dev:
        # Silently skip in non-dev environments - this is expected behavior
        return False

    print(f"  Dev environment detected: {reason}")
    print(f"  Seeding {len(DEV_USERS)} dev users with password: {DEV_PASSWORD}")

    password_hash = _hash_password(DEV_PASSWORD)
    user_ids = {}  # email -> id mapping for paralegal references

    with get_cursor() as cur:
        # First pass: create/update all users
        # Uses UPSERT to preserve IDs - critical for FK relationships!
        for user in DEV_USERS:
            cur.execute("""
                INSERT INTO users (email, password_hash, first_name, last_name, initials,
                                   bar_number, position, is_admin, must_change_password)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, FALSE)
                ON CONFLICT (email) DO UPDATE SET
                    password_hash = EXCLUDED.password_hash,
                    first_name = EXCLUDED.first_name,
                    last_name = EXCLUDED.last_name,
                    initials = EXCLUDED.initials,
                    bar_number = EXCLUDED.bar_number,
                    position = EXCLUDED.position,
                    is_admin = EXCLUDED.is_admin,
                    must_change_password = FALSE,
                    is_active = TRUE,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING id
            """, (
                user["email"].lower(),
                password_hash,
                user["first_name"],
                user["last_name"],
                user["initials"],
                user["bar_number"],
                user["position"],
                user["is_admin"],
            ))
            result = cur.fetchone()
            user_ids[user["email"].lower()] = result["id"] if isinstance(result, dict) else result[0]

        # Second pass: set paralegal relationships
        for user in DEV_USERS:
            if user.get("paralegal_email"):
                paralegal_id = user_ids.get(user["paralegal_email"].lower())
                if paralegal_id:
                    cur.execute("""
                        UPDATE users SET paralegal_id = %s WHERE email = %s
                    """, (paralegal_id, user["email"].lower()))

    print(f"  ✓ {len(DEV_USERS)} dev users seeded (existing relationships preserved)")
    return True
