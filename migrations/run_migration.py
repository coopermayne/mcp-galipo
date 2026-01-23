#!/usr/bin/env python3
"""
Run database migrations.

Usage:
    DATABASE_URL="postgresql://..." python migrations/run_migration.py [migration_file.sql]

If no migration file is specified, runs all migrations in order.
"""

import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor
from pathlib import Path

def get_connection():
    """Get database connection from DATABASE_URL."""
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL environment variable not set")
        sys.exit(1)
    return psycopg2.connect(database_url)

def run_migration(migration_file: Path):
    """Run a single migration file."""
    print(f"Running migration: {migration_file.name}")

    sql = migration_file.read_text()

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
        print(f"  ✓ Migration {migration_file.name} completed successfully")
    except Exception as e:
        conn.rollback()
        print(f"  ✗ Migration {migration_file.name} failed: {e}")
        raise
    finally:
        conn.close()

def main():
    # Load .env if available
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass

    migrations_dir = Path(__file__).parent

    if len(sys.argv) > 1:
        # Run specific migration
        migration_file = migrations_dir / sys.argv[1]
        if not migration_file.exists():
            print(f"ERROR: Migration file not found: {migration_file}")
            sys.exit(1)
        run_migration(migration_file)
    else:
        # Run all SQL migrations in order
        migrations = sorted(migrations_dir.glob("*.sql"))
        if not migrations:
            print("No migrations found")
            return

        print(f"Found {len(migrations)} migration(s)")
        for migration_file in migrations:
            run_migration(migration_file)

    print("\nAll migrations completed!")

if __name__ == "__main__":
    main()
