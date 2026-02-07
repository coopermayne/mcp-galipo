#!/usr/bin/env python3
"""
Seed webhook data from production CSV export.

Run this script to populate the database with CourtListener webhook data
exported from production for development/testing.

Usage:
    python seed_webhook_data.py [path_to_csv]

Default CSV path: data.csv
"""

import os
import sys
import csv
import json

# Load .env file before importing database module
from dotenv import load_dotenv
load_dotenv()

from db.session import SessionLocal
from sqlalchemy import text


def seed_webhook_data(csv_path: str = "data.csv", clear_first: bool = True):
    """Import webhook logs from CSV export."""

    if not os.path.exists(csv_path):
        print(f"Error: CSV file not found: {csv_path}")
        sys.exit(1)

    if clear_first:
        print("Clearing existing webhook_logs...")
        with SessionLocal() as session:
            session.execute(text("DELETE FROM webhook_logs"))
            session.commit()
        print("  Cleared.")

    print(f"Importing webhook data from {csv_path}...")

    imported = 0
    skipped = 0

    with open(csv_path, 'r') as f:
        reader = csv.DictReader(f)

        for row in reader:
            idempotency_key = row.get('idempotency_key') or None

            with SessionLocal() as session:
                # Check if already exists (by idempotency_key)
                if idempotency_key:
                    result = session.execute(
                        text("SELECT id FROM webhook_logs WHERE idempotency_key = :key"),
                        {"key": idempotency_key}
                    ).mappings().first()
                    if result:
                        skipped += 1
                        continue

                # Parse JSON fields
                payload = json.loads(row['payload']) if row.get('payload') else {}
                headers = json.loads(row['headers']) if row.get('headers') else {}

                # Handle nullable integer fields
                proceeding_id = int(row['proceeding_id']) if row.get('proceeding_id') else None
                task_id = int(row['task_id']) if row.get('task_id') else None
                event_id = int(row['event_id']) if row.get('event_id') else None
                event_type = row.get('event_type') or None
                processing_error = row.get('processing_error') or None

                session.execute(text("""
                    INSERT INTO webhook_logs (
                        source, event_type, idempotency_key, payload, headers,
                        proceeding_id, task_id, event_id,
                        processing_status, processing_error
                    )
                    VALUES (:source, :event_type, :idempotency_key, :payload, :headers,
                            :proceeding_id, :task_id, :event_id,
                            :processing_status, :processing_error)
                """), {
                    "source": row['source'],
                    "event_type": event_type,
                    "idempotency_key": idempotency_key,
                    "payload": json.dumps(payload),
                    "headers": json.dumps(headers),
                    "proceeding_id": proceeding_id,
                    "task_id": task_id,
                    "event_id": event_id,
                    "processing_status": row.get('processing_status', 'pending'),
                    "processing_error": processing_error,
                })
                session.commit()
                imported += 1

    print(f"Done! Imported {imported} webhooks, skipped {skipped} duplicates.")


if __name__ == "__main__":
    csv_path = sys.argv[1] if len(sys.argv) > 1 else "data.csv"
    seed_webhook_data(csv_path)
