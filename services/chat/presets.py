"""
Dashboard preset handlers.

Pre-fetches targeted data for common queries, avoiding tool calls entirely.
Data is injected directly into the prompt for faster, cheaper responses.
"""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from db import get_cursor

# Map urgency numbers to names
URGENCY_NAMES = {1: "low", 2: "med", 3: "high", 4: "urgent"}


def get_priorities_context() -> dict:
    """Fetch high-priority tasks and upcoming events for the next 4 weeks.

    Returns a compact context with case names embedded.
    """
    pacific = ZoneInfo("America/Los_Angeles")
    now = datetime.now(pacific)
    four_weeks = now + timedelta(weeks=4)

    with get_cursor() as cur:
        # Get tasks with case names - prioritize by urgency and due date
        cur.execute("""
            SELECT
                t.id,
                t.description,
                t.due_date,
                t.urgency,
                t.status,
                c.id as case_id,
                c.case_name
            FROM tasks t
            JOIN cases c ON t.case_id = c.id
            WHERE t.status != 'completed'
              AND c.status != 'Closed'
              AND (t.due_date IS NULL OR t.due_date <= %s)
            ORDER BY
                t.urgency DESC,
                t.due_date ASC NULLS LAST
        """, (four_weeks.date(),))

        tasks = []
        for row in cur.fetchall():
            tasks.append({
                "id": row["id"],
                "description": row["description"],
                "due_date": row["due_date"].isoformat() if row["due_date"] else None,
                "urgency": URGENCY_NAMES.get(row["urgency"], "low"),
                "status": row["status"],
                "case": row["case_name"],
            })

        # Get upcoming events with case names
        cur.execute("""
            SELECT
                e.id,
                e.description,
                e.date,
                e.time,
                e.location,
                c.id as case_id,
                c.case_name
            FROM events e
            JOIN cases c ON e.case_id = c.id
            WHERE e.date >= %s
              AND e.date <= %s
              AND c.status != 'Closed'
            ORDER BY e.date ASC
        """, (now.date(), four_weeks.date()))

        events = []
        for row in cur.fetchall():
            events.append({
                "id": row["id"],
                "description": row["description"],
                "date": row["date"].isoformat() if row["date"] else None,
                "time": str(row["time"]) if row["time"] else None,
                "location": row["location"],
                "case": row["case_name"],
            })

        # Get overdue count
        cur.execute("""
            SELECT COUNT(*) as count FROM tasks t
            JOIN cases c ON t.case_id = c.id
            WHERE t.status != 'completed'
              AND t.due_date < %s
              AND c.status != 'Closed'
        """, (now.date(),))
        overdue_count = cur.fetchone()["count"]

    return {
        "tasks": tasks,
        "events": events,
        "overdue_count": overdue_count,
        "query_date": now.strftime("%Y-%m-%d"),
        "range_end": four_weeks.strftime("%Y-%m-%d"),
    }


def get_deadlines_context() -> dict:
    """Fetch events and task deadlines for the next 14 days."""
    pacific = ZoneInfo("America/Los_Angeles")
    now = datetime.now(pacific)
    two_weeks = now + timedelta(days=14)

    with get_cursor() as cur:
        # Get events in next 14 days
        cur.execute("""
            SELECT
                e.id,
                e.description,
                e.date,
                e.time,
                e.location,
                c.id as case_id,
                c.case_name
            FROM events e
            JOIN cases c ON e.case_id = c.id
            WHERE e.date >= %s
              AND e.date <= %s
              AND c.status != 'Closed'
            ORDER BY e.date ASC
        """, (now.date(), two_weeks.date()))

        events = []
        for row in cur.fetchall():
            events.append({
                "id": row["id"],
                "description": row["description"],
                "date": row["date"].isoformat() if row["date"] else None,
                "time": str(row["time"]) if row["time"] else None,
                "location": row["location"],
                "case": row["case_name"],
            })

        # Get tasks due in next 14 days
        cur.execute("""
            SELECT
                t.id,
                t.description,
                t.due_date,
                t.urgency,
                t.status,
                c.id as case_id,
                c.case_name
            FROM tasks t
            JOIN cases c ON t.case_id = c.id
            WHERE t.status != 'completed'
              AND t.due_date IS NOT NULL
              AND t.due_date >= %s
              AND t.due_date <= %s
              AND c.status != 'Closed'
            ORDER BY t.due_date ASC
        """, (now.date(), two_weeks.date()))

        tasks = []
        for row in cur.fetchall():
            tasks.append({
                "id": row["id"],
                "description": row["description"],
                "due_date": row["due_date"].isoformat() if row["due_date"] else None,
                "urgency": URGENCY_NAMES.get(row["urgency"], "low"),
                "status": row["status"],
                "case": row["case_name"],
            })

    return {
        "events": events,
        "tasks_due": tasks,
        "query_date": now.strftime("%Y-%m-%d"),
        "range_end": two_weeks.strftime("%Y-%m-%d"),
    }


def get_overdue_context() -> dict:
    """Fetch overdue tasks and past events."""
    pacific = ZoneInfo("America/Los_Angeles")
    now = datetime.now(pacific)

    with get_cursor() as cur:
        # Get overdue tasks
        cur.execute("""
            SELECT
                t.id,
                t.description,
                t.due_date,
                t.urgency,
                t.status,
                c.id as case_id,
                c.case_name
            FROM tasks t
            JOIN cases c ON t.case_id = c.id
            WHERE t.status != 'completed'
              AND t.due_date < %s
              AND c.status != 'Closed'
            ORDER BY t.due_date ASC
        """, (now.date(),))

        overdue_tasks = []
        for row in cur.fetchall():
            overdue_tasks.append({
                "id": row["id"],
                "description": row["description"],
                "due_date": row["due_date"].isoformat() if row["due_date"] else None,
                "urgency": URGENCY_NAMES.get(row["urgency"], "low"),
                "status": row["status"],
                "case": row["case_name"],
            })

    return {
        "overdue_tasks": overdue_tasks,
        "query_date": now.strftime("%Y-%m-%d"),
    }


def get_activity_context() -> dict:
    """Fetch recent activity from the past week."""
    pacific = ZoneInfo("America/Los_Angeles")
    now = datetime.now(pacific)
    one_week_ago = now - timedelta(days=7)

    with get_cursor() as cur:
        # Get recently completed tasks
        cur.execute("""
            SELECT
                t.id,
                t.description,
                t.completion_date,
                c.id as case_id,
                c.case_name
            FROM tasks t
            JOIN cases c ON t.case_id = c.id
            WHERE t.status = 'completed'
              AND t.completion_date >= %s
            ORDER BY t.completion_date DESC
        """, (one_week_ago.date(),))

        completed_tasks = []
        for row in cur.fetchall():
            completed_tasks.append({
                "id": row["id"],
                "description": row["description"],
                "completed_at": row["completion_date"].isoformat() if row["completion_date"] else None,
                "case": row["case_name"],
            })

        # Get recent activities
        cur.execute("""
            SELECT
                a.id,
                a.type,
                a.description,
                a.date,
                c.id as case_id,
                c.case_name
            FROM activities a
            JOIN cases c ON a.case_id = c.id
            WHERE a.date >= %s
            ORDER BY a.date DESC
        """, (one_week_ago.date(),))

        activities = []
        for row in cur.fetchall():
            activities.append({
                "id": row["id"],
                "type": row["type"],
                "description": row["description"],
                "date": row["date"].isoformat() if row["date"] else None,
                "case": row["case_name"],
            })

    return {
        "completed_tasks": completed_tasks,
        "activities": activities,
        "query_date": now.strftime("%Y-%m-%d"),
        "range_start": one_week_ago.strftime("%Y-%m-%d"),
    }


# Preset configurations
PRESETS = {
    "priorities": {
        "fetch": get_priorities_context,
        "prompt": """Based on the following tasks and events, tell me what I should focus on today.
Consider urgency levels (4=highest, 1=lowest), due dates, and event dates.
Prioritize overdue items and high-urgency tasks.

Give me a concise, actionable summary - what are the top 3-5 things I should focus on?""",
    },
    "deadlines": {
        "fetch": get_deadlines_context,
        "prompt": """Here are the upcoming events and task deadlines for the next 14 days.
Organize them by date and highlight anything that needs immediate attention.
Group by week if helpful.""",
    },
    "overdue": {
        "fetch": get_overdue_context,
        "prompt": """Here are the overdue tasks that need attention.
For each, suggest whether to complete it, reschedule it, or delegate it.
Prioritize by urgency level and how overdue it is.""",
    },
    "activity": {
        "fetch": get_activity_context,
        "prompt": """Here's the recent activity from the past week - completed tasks and logged activities.
Give me a brief summary of what's been accomplished across cases.""",
    },
}


def get_preset_context(preset_id: str) -> tuple[dict, str] | None:
    """Get the data context and prompt for a preset.

    Args:
        preset_id: The preset identifier (priorities, deadlines, overdue, activity)

    Returns:
        Tuple of (data_context, prompt) or None if preset not found.
    """
    preset = PRESETS.get(preset_id)
    if not preset:
        return None

    data = preset["fetch"]()
    prompt = preset["prompt"]
    return data, prompt
