#!/usr/bin/env python3
"""
Development User Seed Script for Galipo

Seeds all firm users with a standard dev password (home3232) for local development.

This script is a convenience wrapper around db.dev_users.seed_dev_users().
It's automatically called during app startup via seed_db() if in a dev environment.

You can also run it manually:
    python seed_dev_users.py          # Safe mode - only works on dev databases
    python seed_dev_users.py --force  # Force mode - bypasses safety checks

SAFETY: Only runs on verified dev environments:
  - Database name must contain 'galipo'
  - Database host must be localhost/127.0.0.1 (not remote/cloud)
"""

import os
import sys

# Load .env file before importing database module
from dotenv import load_dotenv
load_dotenv()

from db.dev_users import seed_dev_users, is_dev_environment, DEV_PASSWORD, DEV_USERS


def main():
    if not os.environ.get("DATABASE_URL"):
        print("ERROR: DATABASE_URL environment variable not set")
        print("Usage: set -a && source .env && set +a && python seed_dev_users.py")
        sys.exit(1)

    force = "--force" in sys.argv

    is_dev, reason = is_dev_environment()

    if not is_dev and not force:
        print("ERROR: This script is designed for dev databases only!")
        print(f"  Reason: {reason}")
        print("")
        print("If this is a dev database, either:")
        print("  1. Use a DATABASE_URL with 'galipo' on localhost")
        print("  2. Run with --force flag (use with caution!)")
        sys.exit(1)

    if force and not is_dev:
        print("WARNING: Running in --force mode on a non-dev database!")
        print(f"  Reason for failure: {reason}")
        confirm = input("Are you SURE you want to reset all user passwords? (type 'yes' to confirm): ")
        if confirm.lower() != "yes":
            print("Aborted.")
            sys.exit(0)

    print(f"Seeding {len(DEV_USERS)} dev users with password: {DEV_PASSWORD}")
    print("")

    from db.dev_users import _hash_password
    from db.session import SessionLocal
    from sqlalchemy import text

    password_hash = _hash_password(DEV_PASSWORD)
    user_ids = {}

    with SessionLocal() as session:
        for user in DEV_USERS:
            result = session.execute(text("""
                INSERT INTO users (email, password_hash, first_name, last_name, initials,
                                   bar_number, position, is_admin, must_change_password)
                VALUES (:email, :password_hash, :first_name, :last_name, :initials,
                        :bar_number, :position, :is_admin, FALSE)
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
            """), {
                "email": user["email"].lower(),
                "password_hash": password_hash,
                "first_name": user["first_name"],
                "last_name": user["last_name"],
                "initials": user["initials"],
                "bar_number": user["bar_number"],
                "position": user["position"],
                "is_admin": user["is_admin"],
            })
            row = result.mappings().first()
            user_ids[user["email"].lower()] = row["id"]
            print(f"  ✓ {user['first_name']} {user['last_name']} ({user['email']})")

        print("")
        print("Setting paralegal assignments...")
        for user in DEV_USERS:
            if user.get("paralegal_email"):
                paralegal_id = user_ids.get(user["paralegal_email"].lower())
                if paralegal_id:
                    session.execute(text("""
                        UPDATE users SET paralegal_id = :paralegal_id WHERE email = :email
                    """), {"paralegal_id": paralegal_id, "email": user["email"].lower()})
                    print(f"  ✓ {user['first_name']} {user['last_name']} → {user['paralegal_email'].split('@')[0]}")

        session.commit()

    print("")
    print(f"Done! {len(DEV_USERS)} users seeded with password: {DEV_PASSWORD}")
    print("All users have must_change_password = FALSE")
    print("Existing relationships (tasks, events, cases) are preserved.")


if __name__ == "__main__":
    main()
