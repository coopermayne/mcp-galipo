#!/usr/bin/env python3
"""
Export all case data to a JSON file.

Usage:
    .venv/bin/python scripts/export_data.py [output_file]

The output file defaults to 'galipo_export.json' in the current directory.

Requires DATABASE_URL environment variable to be set. If not set, the script
will attempt to load it from .env file in the project root.
"""

import json
import os
import sys
from datetime import datetime, date, time

# Add parent directory to path for imports
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

# Load .env file if DATABASE_URL is not already set
if not os.environ.get("DATABASE_URL"):
    env_file = os.path.join(project_root, ".env")
    if os.path.exists(env_file):
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    os.environ[key] = value

from db.connection import get_cursor


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


def get_all_cases_with_data() -> list:
    """Get all cases with their complete related data."""
    cases = []

    with get_cursor() as cur:
        # Get all cases
        cur.execute("""
            SELECT id, case_name, short_name, status, print_code, case_summary,
                   result, date_of_injury, case_numbers, created_at, updated_at
            FROM cases
            ORDER BY case_name
        """)
        case_rows = [dict(row) for row in cur.fetchall()]

        for case_row in case_rows:
            case_id = case_row["id"]
            case_data = serialize_row(case_row)

            # Parse case_numbers JSONB if it's a string
            if case_data.get("case_numbers") and isinstance(case_data["case_numbers"], str):
                case_data["case_numbers"] = json.loads(case_data["case_numbers"])

            # Get persons assigned to this case
            cur.execute("""
                SELECT p.id as person_id, p.person_type, p.name, p.phones, p.emails,
                       p.address, p.organization, p.attributes, p.notes as person_notes,
                       p.archived,
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
            case_data["persons"] = [serialize_row(dict(row)) for row in cur.fetchall()]

            # Get tasks
            cur.execute("""
                SELECT id, due_date, completion_date, description, status, urgency,
                       event_id, sort_order, created_at
                FROM tasks
                WHERE case_id = %s
                ORDER BY sort_order ASC
            """, (case_id,))
            case_data["tasks"] = [serialize_row(dict(row)) for row in cur.fetchall()]

            # Get events
            cur.execute("""
                SELECT id, date, time, location, description, document_link,
                       calculation_note, starred, created_at
                FROM events
                WHERE case_id = %s
                ORDER BY date
            """, (case_id,))
            case_data["events"] = [serialize_row(dict(row)) for row in cur.fetchall()]

            # Get notes
            cur.execute("""
                SELECT id, content, created_at, updated_at
                FROM notes
                WHERE case_id = %s
                ORDER BY created_at DESC
            """, (case_id,))
            case_data["notes"] = [serialize_row(dict(row)) for row in cur.fetchall()]

            # Get activities
            cur.execute("""
                SELECT id, date, description, type, minutes, created_at
                FROM activities
                WHERE case_id = %s
                ORDER BY date DESC
            """, (case_id,))
            case_data["activities"] = [serialize_row(dict(row)) for row in cur.fetchall()]

            # Get proceedings with their judges
            cur.execute("""
                SELECT p.id, p.case_number, p.jurisdiction_id, p.sort_order,
                       p.is_primary, p.notes, p.created_at, p.updated_at,
                       j.name as jurisdiction_name, j.local_rules_link
                FROM proceedings p
                LEFT JOIN jurisdictions j ON p.jurisdiction_id = j.id
                WHERE p.case_id = %s
                ORDER BY p.sort_order, p.id
            """, (case_id,))
            proceedings = [dict(row) for row in cur.fetchall()]

            # Fetch judges for all proceedings
            if proceedings:
                proceeding_ids = [p["id"] for p in proceedings]
                cur.execute("""
                    SELECT pj.proceeding_id, pj.person_id, pj.role, pj.sort_order,
                           pj.created_at, per.name as judge_name
                    FROM judges pj
                    JOIN persons per ON pj.person_id = per.id
                    WHERE pj.proceeding_id = ANY(%s)
                    ORDER BY pj.sort_order, pj.id
                """, (proceeding_ids,))

                judges_by_proceeding = {}
                for row in cur.fetchall():
                    pid = row["proceeding_id"]
                    if pid not in judges_by_proceeding:
                        judges_by_proceeding[pid] = []
                    judges_by_proceeding[pid].append(serialize_row({
                        "person_id": row["person_id"],
                        "name": row["judge_name"],
                        "role": row["role"],
                        "sort_order": row["sort_order"],
                        "created_at": row["created_at"]
                    }))

                for p in proceedings:
                    p["judges"] = judges_by_proceeding.get(p["id"], [])

            case_data["proceedings"] = [serialize_row(p) for p in proceedings]

            cases.append(case_data)

    return cases


def export_all_data() -> dict:
    """Export all data from the database."""
    return {
        "exported_at": datetime.now().isoformat(),
        "version": "1.0",
        "cases": get_all_cases_with_data(),
    }


def main():
    output_file = sys.argv[1] if len(sys.argv) > 1 else "galipo_export.json"

    print(f"Exporting data to {output_file}...")

    data = export_all_data()

    with open(output_file, "w") as f:
        json.dump(data, f, indent=2)

    # Print summary
    print(f"\nExport complete!")
    print(f"  - Cases: {len(data['cases'])}")
    print(f"\nOutput written to: {output_file}")


if __name__ == "__main__":
    main()
