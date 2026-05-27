from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import Date, cast, func

UTC = timezone.utc
LA = ZoneInfo("America/Los_Angeles")


def utc_now() -> datetime:
    return datetime.now(UTC)


def today_la() -> date:
    """Current calendar date in America/Los_Angeles."""
    return datetime.now(LA).date()


def today_la_sql():
    """SQLAlchemy expression for the current date in America/Los_Angeles.

    Use instead of func.current_date(): current_date resolves in the database's
    timezone (UTC in production), so in the evening Pacific it has already
    rolled over to the next calendar day, which silently drops same-day events
    and tasks from "today" filters.
    """
    return cast(func.timezone("America/Los_Angeles", func.now()), Date)
