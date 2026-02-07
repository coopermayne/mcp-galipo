"""
Activity/time tracking functions — SQLAlchemy ORM implementation.
"""

from typing import Optional, List

from sqlalchemy import select, func
from sqlalchemy.orm import joinedload

from .session import SessionLocal
from .validation import validate_date_format
from models import Activity, Case
from schemas import ActivityOut


def _serialize(obj: Activity) -> dict:
    """Convert an Activity ORM object to a JSON-safe dict."""
    return ActivityOut.model_validate(obj).model_dump(mode="json")


def add_activity(case_id: int, description: str, activity_type: str,
                 date: str, minutes: int = None) -> dict:
    """Add an activity to a case."""
    validate_date_format(date, "date")

    with SessionLocal() as session:
        activity = Activity(
            case_id=case_id,
            description=description,
            type=activity_type,
            date=date,
            minutes=minutes,
        )
        session.add(activity)
        session.flush()
        session.refresh(activity)
        result = _serialize(activity)
        session.commit()
        return result


def get_all_activities(case_id: int = None) -> List[dict]:
    """Get all activities, optionally filtered by case."""
    with SessionLocal() as session:
        stmt = (
            select(Activity)
            .join(Activity.case)
            .options(joinedload(Activity.case))
            .order_by(Activity.date.desc())
        )
        if case_id:
            stmt = stmt.where(Activity.case_id == case_id)

        activities = session.scalars(stmt).unique().all()
        return [
            {
                "id": a.id,
                "case_id": a.case_id,
                "case_name": a.case.case_name if a.case else None,
                "description": a.description,
                "type": a.type,
                "date": a.date.isoformat() if a.date else None,
                "minutes": a.minutes,
            }
            for a in activities
        ]


def get_activities(case_id: int = None) -> dict:
    """Get activities with total count, optionally filtered by case."""
    with SessionLocal() as session:
        base = select(Activity)
        if case_id:
            base = base.where(Activity.case_id == case_id)

        # Count
        count_stmt = select(func.count()).select_from(base.subquery())
        total = session.scalar(count_stmt)

        # List with joined case
        stmt = (
            base
            .join(Activity.case)
            .options(joinedload(Activity.case))
            .order_by(Activity.date.desc())
        )
        activities = session.scalars(stmt).unique().all()

        rows = [
            {
                "id": a.id,
                "case_id": a.case_id,
                "case_name": a.case.case_name if a.case else None,
                "short_name": a.case.short_name if a.case else None,
                "description": a.description,
                "type": a.type,
                "date": a.date.isoformat() if a.date else None,
                "minutes": a.minutes,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in activities
        ]
        return {"activities": rows, "total": total}


def update_activity(activity_id: int, date: str = None, description: str = None,
                    activity_type: str = None, minutes: int = None) -> Optional[dict]:
    """Update an activity."""
    if date is not None:
        validate_date_format(date, "date")

    # Nothing to update
    if all(v is None for v in (date, description, activity_type, minutes)):
        return None

    with SessionLocal() as session:
        activity = session.get(Activity, activity_id)
        if not activity:
            return None

        if date is not None:
            activity.date = date
        if description is not None:
            activity.description = description
        if activity_type is not None:
            activity.type = activity_type
        if minutes is not None:
            activity.minutes = minutes

        session.flush()
        session.refresh(activity)
        result = _serialize(activity)
        session.commit()
        return result


def delete_activity(activity_id: int) -> bool:
    """Delete an activity."""
    with SessionLocal() as session:
        activity = session.get(Activity, activity_id)
        if not activity:
            return False
        session.delete(activity)
        session.commit()
        return True
