"""
Intake CRUD operations and Google Sheet sync.
"""

import datetime
import logging
from typing import Optional

from sqlalchemy import select, func

from .session import SessionLocal
from models import Intake
from schemas import IntakeOut

logger = logging.getLogger(__name__)


def _intake_to_dict(intake: Intake) -> dict:
    """Convert an Intake ORM instance to a serializable dict."""
    return IntakeOut.model_validate(intake).model_dump(mode="json")


def get_intakes(
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> dict:
    """Get intakes with optional status filter and pagination."""
    with SessionLocal() as session:
        filters = []
        if status:
            filters.append(Intake.status == status)

        count_stmt = select(func.count(Intake.id))
        for f in filters:
            count_stmt = count_stmt.where(f)
        total = session.scalar(count_stmt)

        stmt = (
            select(Intake)
            .order_by(Intake.submitted_on.desc().nullslast(), Intake.id.desc())
            .limit(limit)
            .offset(offset)
        )
        for f in filters:
            stmt = stmt.where(f)

        intakes = session.scalars(stmt).all()
        return {
            "intakes": [_intake_to_dict(i) for i in intakes],
            "total": total,
        }


def get_intake_status_counts() -> dict[str, int]:
    """Get count of intakes grouped by status (excludes Archived)."""
    with SessionLocal() as session:
        rows = session.execute(
            select(Intake.status, func.count(Intake.id))
            .where(Intake.status != "Archived")
            .group_by(Intake.status)
        ).all()
        return {status: count for status, count in rows}


def get_intake_by_id(intake_id: int) -> Optional[dict]:
    """Get a single intake by ID."""
    with SessionLocal() as session:
        intake = session.get(Intake, intake_id)
        if not intake:
            return None
        return _intake_to_dict(intake)


def update_intake(intake_id: int, **kwargs) -> Optional[dict]:
    """Update an intake's status and/or notes."""
    with SessionLocal() as session:
        intake = session.get(Intake, intake_id)
        if not intake:
            return None

        for key, value in kwargs.items():
            if value is not None and hasattr(intake, key):
                setattr(intake, key, value)

        intake.updated_at = func.now()
        session.flush()
        session.refresh(intake)
        result = _intake_to_dict(intake)
        session.commit()
        return result


def delete_intake(intake_id: int) -> bool:
    """Delete an intake record."""
    with SessionLocal() as session:
        intake = session.get(Intake, intake_id)
        if not intake:
            return False
        session.delete(intake)
        session.commit()
        return True


def _parse_date(value: Optional[str]) -> Optional[datetime.date]:
    """Parse a date string from Google Sheets (multiple formats)."""
    if not value:
        return None
    for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%m-%d-%Y", "%m/%d/%y"):
        try:
            return datetime.datetime.strptime(value.strip(), fmt).date()
        except (ValueError, AttributeError):
            continue
    return None


def _parse_datetime(value: Optional[str]) -> Optional[datetime.datetime]:
    """Parse a datetime string from Google Sheets (multiple formats)."""
    if not value:
        return None
    cleaned = value.strip()
    # Handle "MM/DD/YYYY at H:MM am/pm" format from Google Forms
    if " at " in cleaned:
        cleaned = cleaned.replace(" at ", " ")
    for fmt in (
        "%m/%d/%Y %I:%M %p",
        "%m/%d/%Y %I:%M:%S %p",
        "%m/%d/%Y %H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%m/%d/%Y",
        "%Y-%m-%d",
    ):
        try:
            return datetime.datetime.strptime(cleaned, fmt)
        except (ValueError, AttributeError):
            continue
    return None


def sync_from_sheet(rows: list[dict]) -> dict:
    """Upsert rows from Google Sheet. Skips existing rows by google_row_number.

    Returns {"imported": N, "skipped": N, "total": N}.
    """
    imported = 0
    skipped = 0

    with SessionLocal() as session:
        # Get existing row numbers for dedup
        existing_rows = set(
            session.scalars(select(Intake.google_row_number)).all()
        )

        for row in rows:
            row_num = row["google_row_number"]
            if row_num in existing_rows:
                skipped += 1
                continue

            intake = Intake(
                google_row_number=row_num,
                submitted_on=_parse_datetime(row.get("submitted_on")),
                name=row.get("name"),
                email=row.get("email"),
                phone=row.get("phone"),
                case_type=row.get("case_type"),
                incident_date=_parse_date(row.get("incident_date")),
                incident_time=row.get("incident_time"),
                location=row.get("location"),
                incident_description=row.get("incident_description"),
                injury_description=row.get("injury_description"),
                disclaimer_accepted=row.get("disclaimer_accepted", False),
                status="New",
            )
            session.add(intake)
            imported += 1

        session.commit()

    logger.info("Sync complete: %d imported, %d skipped", imported, skipped)
    return {"imported": imported, "skipped": skipped, "total": len(rows)}
