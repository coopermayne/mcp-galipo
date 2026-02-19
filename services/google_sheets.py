"""
Google Sheets integration for intake form sync.

Reads all rows from a configured Google Sheet (service account auth)
and returns them as dicts ready for DB upsert.
"""

import json
import logging

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

from config import settings

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

# Column mapping: sheet column index → dict key
# Based on known form column order (A through K)
COLUMN_MAP = [
    "submitted_on",         # A
    "name",                 # B
    "email",                # C
    "phone",                # D
    "case_type",            # E
    "incident_date",        # F
    "incident_time",        # G
    "location",             # H
    "incident_description", # I
    "injury_description",   # J
    "disclaimer_accepted",  # K
]


def _get_credentials_data() -> dict:
    """Load service account credentials from file or env var."""
    # Prefer file path (avoids shell quoting issues with JSON in .env)
    if settings.google_sheets_credentials_file:
        with open(settings.google_sheets_credentials_file) as f:
            return json.load(f)
    if settings.google_sheets_credentials_json:
        return json.loads(settings.google_sheets_credentials_json)
    raise RuntimeError(
        "Google Sheets credentials not configured. "
        "Set GOOGLE_SHEETS_CREDENTIALS_FILE (path to JSON key file) "
        "or GOOGLE_SHEETS_CREDENTIALS_JSON in .env."
    )


def _get_service():
    """Build an authenticated Google Sheets API service."""
    if not settings.google_sheets_spreadsheet_id:
        raise RuntimeError(
            "GOOGLE_SHEETS_SPREADSHEET_ID is not configured. "
            "Set it in .env with the spreadsheet ID."
        )
    creds_data = _get_credentials_data()
    creds = Credentials.from_service_account_info(creds_data, scopes=SCOPES)
    return build("sheets", "v4", credentials=creds)


def fetch_all_rows() -> list[dict]:
    """Fetch all data rows from the configured Google Sheet.

    Returns a list of dicts with field names from COLUMN_MAP
    plus `google_row_number` (1-indexed, skipping header row).
    """
    service = _get_service()
    sheet = service.spreadsheets()

    result = sheet.values().get(
        spreadsheetId=settings.google_sheets_spreadsheet_id,
        range="A:K",
    ).execute()

    values = result.get("values", [])
    if not values:
        return []

    rows = []
    # Skip header row (index 0); data rows start at index 1
    for i, row in enumerate(values[1:], start=2):
        record = {"google_row_number": i}
        for col_idx, field_name in enumerate(COLUMN_MAP):
            value = row[col_idx] if col_idx < len(row) else ""
            # Convert disclaimer field to boolean
            if field_name == "disclaimer_accepted":
                value = value.strip().lower() in ("yes", "true", "1", "accepted")
            record[field_name] = value if value != "" else None
        rows.append(record)

    logger.info("Fetched %d rows from Google Sheet", len(rows))
    return rows
