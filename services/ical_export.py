"""iCalendar (.ics) export for events.

Produces RFC 5545 VCALENDAR text with one VEVENT per event. Hand-rolled so we
don't pull in another dependency — events are simple (date or date+time,
description, location, optional URL) and there's no recurrence yet.
"""

from datetime import datetime, date, time, timedelta
from typing import Iterable, Optional
from zoneinfo import ZoneInfo

LA = ZoneInfo("America/Los_Angeles")
PRODID = "-//Galipo//Case Management//EN"


def _escape(value: str) -> str:
    """Escape per RFC 5545 §3.3.11."""
    if value is None:
        return ""
    return (
        value.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
        .replace("\r", "")
    )


def _fold(line: str) -> str:
    """Fold lines > 75 octets per RFC 5545 §3.1 (CRLF + space continuation).

    The 75-octet limit is BYTES, not characters — multi-byte UTF-8 in summaries
    (e.g. the ⭐ prefix) means we must measure on the encoded form.
    """
    encoded = line.encode("utf-8")
    if len(encoded) <= 75:
        return line
    # Walk forward in byte-space, but never split a UTF-8 character.
    chunks: list[str] = []
    first = True
    i = 0
    while i < len(encoded):
        limit = 75 if first else 74
        end = min(i + limit, len(encoded))
        # Back off to a UTF-8 boundary if we'd land mid-character.
        while end < len(encoded) and (encoded[end] & 0xC0) == 0x80:
            end -= 1
        chunk = encoded[i:end].decode("utf-8")
        chunks.append(chunk if first else " " + chunk)
        first = False
        i = end
    return "\r\n".join(chunks)


def _utc_stamp(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=LA)
    return dt.astimezone(ZoneInfo("UTC")).strftime("%Y%m%dT%H%M%SZ")


def _parse_date(value) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        try:
            return date.fromisoformat(value[:10])
        except ValueError:
            return None
    return None


def _parse_time(value) -> Optional[time]:
    if value is None:
        return None
    if isinstance(value, time):
        return value
    if isinstance(value, str):
        try:
            # accept "HH:MM" or "HH:MM:SS"
            parts = value.split(":")
            h = int(parts[0])
            m = int(parts[1]) if len(parts) > 1 else 0
            s = int(parts[2]) if len(parts) > 2 else 0
            return time(h, m, s)
        except (ValueError, IndexError):
            return None
    return None


def _event_lines(event: dict, now_stamp: str) -> list[str]:
    """Build the VEVENT lines for a single event dict."""
    eid = event.get("id")
    description = event.get("description") or "Event"
    location = event.get("location")
    document_link = event.get("document_link")
    case_name = event.get("case_name") or event.get("short_name")
    starred = event.get("starred")

    start_date = _parse_date(event.get("date"))
    end_date_field = _parse_date(event.get("end_date"))
    t = _parse_time(event.get("time"))

    if start_date is None:
        return []

    lines = ["BEGIN:VEVENT", f"UID:event-{eid}@galipo", f"DTSTAMP:{now_stamp}"]

    if t is not None:
        # Timed event — 1 hour default duration
        start_dt = datetime.combine(start_date, t, tzinfo=LA)
        end_dt = start_dt + timedelta(hours=1)
        lines.append(f"DTSTART;TZID=America/Los_Angeles:{start_dt.strftime('%Y%m%dT%H%M%S')}")
        lines.append(f"DTEND;TZID=America/Los_Angeles:{end_dt.strftime('%Y%m%dT%H%M%S')}")
    else:
        # All-day event — DTEND is exclusive per RFC, so add 1 day to end_date
        end_d = end_date_field or start_date
        lines.append(f"DTSTART;VALUE=DATE:{start_date.strftime('%Y%m%d')}")
        lines.append(f"DTEND;VALUE=DATE:{(end_d + timedelta(days=1)).strftime('%Y%m%d')}")

    summary = description
    if case_name:
        summary = f"[{case_name}] {description}"
    if starred:
        summary = f"⭐ {summary}"
    lines.append(f"SUMMARY:{_escape(summary)}")

    if location:
        lines.append(f"LOCATION:{_escape(location)}")

    desc_parts = []
    if case_name:
        desc_parts.append(f"Case: {case_name}")
    if event.get("event_type"):
        desc_parts.append(f"Type: {event['event_type']}")
    if event.get("calculation_note"):
        desc_parts.append(f"Notes: {event['calculation_note']}")
    if desc_parts:
        lines.append(f"DESCRIPTION:{_escape(chr(10).join(desc_parts))}")

    if document_link:
        lines.append(f"URL:{_escape(document_link)}")

    lines.append("END:VEVENT")
    return lines


def build_ics_from_events(events: Iterable[dict]) -> str:
    """Render an iterable of event dicts (as returned by db.get_*_event*) to .ics text."""
    now_stamp = _utc_stamp(datetime.now(LA))

    raw_lines = ["BEGIN:VCALENDAR", "VERSION:2.0", f"PRODID:{PRODID}", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"]
    for event in events:
        raw_lines.extend(_event_lines(event, now_stamp))
    raw_lines.append("END:VCALENDAR")

    # Apply RFC 5545 line folding and CRLF line endings
    return "\r\n".join(_fold(line) for line in raw_lines) + "\r\n"
