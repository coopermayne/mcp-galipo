from datetime import datetime, timezone
from zoneinfo import ZoneInfo

UTC = timezone.utc
LA = ZoneInfo("America/Los_Angeles")


def utc_now() -> datetime:
    return datetime.now(UTC)
