"""
Dashboard preset handlers.

Pre-fetches targeted data for common queries, avoiding tool calls entirely.
Data is injected directly into the prompt for faster, cheaper responses.
"""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from sqlalchemy import text
from db.session import SessionLocal

URGENCY_SQL_ORDER = """CASE t.urgency WHEN 'Urgent' THEN 4 WHEN 'High' THEN 3 WHEN 'Medium' THEN 2 ELSE 1 END"""


def _user_filter_sql(user_id: int | None) -> str:
    """Return SQL clause to filter by user's assigned cases."""
    if user_id:
        return "AND (c.attorney_ids @> ARRAY[:user_id]::integer[] OR c.paralegal_ids @> ARRAY[:user_id]::integer[])"
    return ""


def _user_params(user_id: int | None, base_params: dict) -> dict:
    """Merge user_id into SQL params if present."""
    if user_id:
        return {**base_params, "user_id": user_id}
    return base_params


def get_priorities_context(user_id: int | None = None) -> dict:
    """Fetch high-priority tasks and upcoming events for the next 4 weeks.

    Returns a compact context with case names embedded.
    """
    pacific = ZoneInfo("America/Los_Angeles")
    now = datetime.now(pacific)
    four_weeks = now + timedelta(weeks=4)
    uf = _user_filter_sql(user_id)

    with SessionLocal() as session:
        # Get tasks with case names - prioritize by urgency and due date
        rows = session.execute(text(f"""
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
            WHERE t.status != 'Done'
              AND c.status != 'Closed'
              AND (t.due_date IS NULL OR t.due_date <= :four_weeks)
              {uf}
            ORDER BY
                CASE t.urgency WHEN 'Urgent' THEN 4 WHEN 'High' THEN 3 WHEN 'Medium' THEN 2 ELSE 1 END DESC,
                t.due_date ASC NULLS LAST
        """), _user_params(user_id, {"four_weeks": four_weeks.date()})).mappings().all()

        tasks = []
        for row in rows:
            tasks.append({
                "id": row["id"],
                "description": row["description"],
                "due_date": row["due_date"].isoformat() if row["due_date"] else None,
                "urgency": row["urgency"].lower() if row["urgency"] else "low",
                "status": row["status"],
                "case": row["case_name"],
            })

        # Get upcoming events with case names
        rows = session.execute(text(f"""
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
            WHERE e.date >= :now_date
              AND e.date <= :four_weeks
              AND c.status != 'Closed'
              {uf}
            ORDER BY e.date ASC
        """), _user_params(user_id, {"now_date": now.date(), "four_weeks": four_weeks.date()})).mappings().all()

        events = []
        for row in rows:
            events.append({
                "id": row["id"],
                "description": row["description"],
                "date": row["date"].isoformat() if row["date"] else None,
                "time": str(row["time"]) if row["time"] else None,
                "location": row["location"],
                "case": row["case_name"],
            })

        # Get overdue count
        result = session.execute(text(f"""
            SELECT COUNT(*) as count FROM tasks t
            JOIN cases c ON t.case_id = c.id
            WHERE t.status != 'Done'
              AND t.due_date < :now_date
              AND c.status != 'Closed'
              {uf}
        """), _user_params(user_id, {"now_date": now.date()})).mappings().first()
        overdue_count = result["count"]

    return {
        "tasks": tasks,
        "events": events,
        "overdue_count": overdue_count,
        "query_date": now.strftime("%Y-%m-%d"),
        "range_end": four_weeks.strftime("%Y-%m-%d"),
    }


def get_deadlines_context(user_id: int | None = None) -> dict:
    """Fetch events and task deadlines for the next 14 days."""
    pacific = ZoneInfo("America/Los_Angeles")
    now = datetime.now(pacific)
    two_weeks = now + timedelta(days=14)
    uf = _user_filter_sql(user_id)

    with SessionLocal() as session:
        # Get events in next 14 days
        rows = session.execute(text(f"""
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
            WHERE e.date >= :now_date
              AND e.date <= :two_weeks
              AND c.status != 'Closed'
              {uf}
            ORDER BY e.date ASC
        """), _user_params(user_id, {"now_date": now.date(), "two_weeks": two_weeks.date()})).mappings().all()

        events = []
        for row in rows:
            events.append({
                "id": row["id"],
                "description": row["description"],
                "date": row["date"].isoformat() if row["date"] else None,
                "time": str(row["time"]) if row["time"] else None,
                "location": row["location"],
                "case": row["case_name"],
            })

        # Get tasks due in next 14 days
        rows = session.execute(text(f"""
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
            WHERE t.status != 'Done'
              AND t.due_date IS NOT NULL
              AND t.due_date >= :now_date
              AND t.due_date <= :two_weeks
              AND c.status != 'Closed'
              {uf}
            ORDER BY t.due_date ASC
        """), _user_params(user_id, {"now_date": now.date(), "two_weeks": two_weeks.date()})).mappings().all()

        tasks = []
        for row in rows:
            tasks.append({
                "id": row["id"],
                "description": row["description"],
                "due_date": row["due_date"].isoformat() if row["due_date"] else None,
                "urgency": row["urgency"].lower() if row["urgency"] else "low",
                "status": row["status"],
                "case": row["case_name"],
            })

    return {
        "events": events,
        "tasks_due": tasks,
        "query_date": now.strftime("%Y-%m-%d"),
        "range_end": two_weeks.strftime("%Y-%m-%d"),
    }


def get_overdue_context(user_id: int | None = None) -> dict:
    """Fetch overdue tasks and past events."""
    pacific = ZoneInfo("America/Los_Angeles")
    now = datetime.now(pacific)
    uf = _user_filter_sql(user_id)

    with SessionLocal() as session:
        # Get overdue tasks
        rows = session.execute(text(f"""
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
            WHERE t.status != 'Done'
              AND t.due_date < :now_date
              AND c.status != 'Closed'
              {uf}
            ORDER BY t.due_date ASC
        """), _user_params(user_id, {"now_date": now.date()})).mappings().all()

        overdue_tasks = []
        for row in rows:
            overdue_tasks.append({
                "id": row["id"],
                "description": row["description"],
                "due_date": row["due_date"].isoformat() if row["due_date"] else None,
                "urgency": row["urgency"].lower() if row["urgency"] else "low",
                "status": row["status"],
                "case": row["case_name"],
            })

    return {
        "overdue_tasks": overdue_tasks,
        "query_date": now.strftime("%Y-%m-%d"),
    }


def get_activity_context(user_id: int | None = None) -> dict:
    """Fetch recent activity from the past week."""
    pacific = ZoneInfo("America/Los_Angeles")
    now = datetime.now(pacific)
    one_week_ago = now - timedelta(days=7)
    uf = _user_filter_sql(user_id)

    with SessionLocal() as session:
        # Get recently completed tasks
        rows = session.execute(text(f"""
            SELECT
                t.id,
                t.description,
                t.completion_date,
                c.id as case_id,
                c.case_name
            FROM tasks t
            JOIN cases c ON t.case_id = c.id
            WHERE t.status = 'Done'
              AND t.completion_date >= :one_week_ago
              {uf}
            ORDER BY t.completion_date DESC
        """), _user_params(user_id, {"one_week_ago": one_week_ago.date()})).mappings().all()

        completed_tasks = []
        for row in rows:
            completed_tasks.append({
                "id": row["id"],
                "description": row["description"],
                "completed_at": row["completion_date"].isoformat() if row["completion_date"] else None,
                "case": row["case_name"],
            })

        # Get recent activities
        rows = session.execute(text(f"""
            SELECT
                a.id,
                a.type,
                a.description,
                a.date,
                c.id as case_id,
                c.case_name
            FROM activities a
            JOIN cases c ON a.case_id = c.id
            WHERE a.date >= :one_week_ago
              {uf}
            ORDER BY a.date DESC
        """), _user_params(user_id, {"one_week_ago": one_week_ago.date()})).mappings().all()

        activities = []
        for row in rows:
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


# =============================================================================
# Case-specific context fetchers (for case page modes)
# =============================================================================

def get_case_summary_context(case_id: int) -> dict:
    """Fetch a summary of a case - status, key dates, and current state."""
    pacific = ZoneInfo("America/Los_Angeles")
    now = datetime.now(pacific)
    two_weeks = now + timedelta(days=14)

    with SessionLocal() as session:
        # Get case info
        case_row = session.execute(text("""
            SELECT id, case_name, short_name, status, case_summary, date_of_injury
            FROM cases WHERE id = :case_id
        """), {"case_id": case_id}).mappings().first()
        if not case_row:
            return {"error": "Case not found"}

        case_info = {
            "name": case_row["case_name"],
            "short_name": case_row["short_name"],
            "status": case_row["status"],
            "summary": case_row["case_summary"],
            "date_of_injury": case_row["date_of_injury"].isoformat() if case_row["date_of_injury"] else None,
        }

        # Count tasks by status
        rows = session.execute(text("""
            SELECT status, COUNT(*) as count FROM tasks
            WHERE case_id = :case_id GROUP BY status
        """), {"case_id": case_id}).mappings().all()
        task_counts = {row["status"]: row["count"] for row in rows}

        # Get overdue count
        result = session.execute(text("""
            SELECT COUNT(*) as count FROM tasks
            WHERE case_id = :case_id AND status != 'Done' AND due_date < :now_date
        """), {"case_id": case_id, "now_date": now.date()}).mappings().first()
        overdue_count = result["count"]

        # Get upcoming events (next 2 weeks)
        rows = session.execute(text("""
            SELECT description, date FROM events
            WHERE case_id = :case_id AND date >= :now_date AND date <= :two_weeks
            ORDER BY date ASC LIMIT 5
        """), {"case_id": case_id, "now_date": now.date(), "two_weeks": two_weeks.date()}).mappings().all()
        upcoming_events = [{"description": r["description"], "date": r["date"].isoformat()} for r in rows]

        # Get key people (clients and primary contacts)
        rows = session.execute(text("""
            SELECT p.name, r.name as role FROM person_roles pr
            JOIN persons p ON pr.person_id = p.id
            JOIN roles r ON pr.role_id = r.id
            WHERE pr.case_id = :case_id AND (r.name = 'Client' OR pr.is_primary = true)
            LIMIT 5
        """), {"case_id": case_id}).mappings().all()
        key_people = [{"name": r["name"], "role": r["role"]} for r in rows]

    return {
        "case": case_info,
        "task_counts": task_counts,
        "overdue_count": overdue_count,
        "upcoming_events": upcoming_events,
        "key_people": key_people,
        "query_date": now.strftime("%Y-%m-%d"),
    }


def get_case_next_steps_context(case_id: int) -> dict:
    """Fetch what needs to happen next on this case."""
    pacific = ZoneInfo("America/Los_Angeles")
    now = datetime.now(pacific)
    two_weeks = now + timedelta(days=14)

    with SessionLocal() as session:
        # Get case name
        row = session.execute(text("SELECT case_name FROM cases WHERE id = :case_id"), {"case_id": case_id}).mappings().first()
        case_name = row["case_name"] if row else f"Case #{case_id}"

        # Get high priority incomplete tasks
        rows = session.execute(text("""
            SELECT id, description, due_date, urgency, status
            FROM tasks
            WHERE case_id = :case_id AND status != 'Done'
            ORDER BY CASE urgency WHEN 'Urgent' THEN 4 WHEN 'High' THEN 3 WHEN 'Medium' THEN 2 ELSE 1 END DESC, due_date ASC NULLS LAST
            LIMIT 10
        """), {"case_id": case_id}).mappings().all()
        priority_tasks = []
        for row in rows:
            priority_tasks.append({
                "id": row["id"],
                "description": row["description"],
                "due_date": row["due_date"].isoformat() if row["due_date"] else None,
                "urgency": row["urgency"].lower() if row["urgency"] else "low",
            })

        # Get upcoming events
        rows = session.execute(text("""
            SELECT id, description, date, time, location
            FROM events
            WHERE case_id = :case_id AND date >= :now_date AND date <= :two_weeks
            ORDER BY date ASC
        """), {"case_id": case_id, "now_date": now.date(), "two_weeks": two_weeks.date()}).mappings().all()
        upcoming_events = []
        for row in rows:
            upcoming_events.append({
                "id": row["id"],
                "description": row["description"],
                "date": row["date"].isoformat() if row["date"] else None,
                "time": str(row["time"]) if row["time"] else None,
                "location": row["location"],
            })

        # Get overdue tasks
        rows = session.execute(text("""
            SELECT id, description, due_date, urgency
            FROM tasks
            WHERE case_id = :case_id AND status != 'Done' AND due_date < :now_date
            ORDER BY due_date ASC
        """), {"case_id": case_id, "now_date": now.date()}).mappings().all()
        overdue = []
        for row in rows:
            overdue.append({
                "id": row["id"],
                "description": row["description"],
                "due_date": row["due_date"].isoformat() if row["due_date"] else None,
                "urgency": row["urgency"].lower() if row["urgency"] else "low",
            })

    return {
        "case": case_name,
        "priority_tasks": priority_tasks,
        "upcoming_events": upcoming_events,
        "overdue_tasks": overdue,
        "query_date": now.strftime("%Y-%m-%d"),
    }


def get_case_tasks_context(case_id: int) -> dict:
    """Fetch all tasks for a specific case."""
    pacific = ZoneInfo("America/Los_Angeles")
    now = datetime.now(pacific)

    with SessionLocal() as session:
        # Get case name
        row = session.execute(text("SELECT case_name FROM cases WHERE id = :case_id"), {"case_id": case_id}).mappings().first()
        case_name = row["case_name"] if row else f"Case #{case_id}"

        # Get incomplete tasks
        rows = session.execute(text("""
            SELECT id, description, due_date, urgency, status
            FROM tasks
            WHERE case_id = :case_id AND status != 'Done'
            ORDER BY CASE urgency WHEN 'Urgent' THEN 4 WHEN 'High' THEN 3 WHEN 'Medium' THEN 2 ELSE 1 END DESC, due_date ASC NULLS LAST
        """), {"case_id": case_id}).mappings().all()

        incomplete = []
        for row in rows:
            incomplete.append({
                "id": row["id"],
                "description": row["description"],
                "due_date": row["due_date"].isoformat() if row["due_date"] else None,
                "urgency": row["urgency"].lower() if row["urgency"] else "low",
                "status": row["status"],
            })

        # Get recently completed tasks (last 2 weeks)
        two_weeks_ago = now - timedelta(days=14)
        rows = session.execute(text("""
            SELECT id, description, completion_date
            FROM tasks
            WHERE case_id = :case_id AND status = 'Done' AND completion_date >= :two_weeks_ago
            ORDER BY completion_date DESC
        """), {"case_id": case_id, "two_weeks_ago": two_weeks_ago.date()}).mappings().all()

        completed = []
        for row in rows:
            completed.append({
                "id": row["id"],
                "description": row["description"],
                "completed": row["completion_date"].isoformat() if row["completion_date"] else None,
            })

        # Count overdue
        result = session.execute(text("""
            SELECT COUNT(*) as count FROM tasks
            WHERE case_id = :case_id AND status != 'Done' AND due_date < :now_date
        """), {"case_id": case_id, "now_date": now.date()}).mappings().first()
        overdue_count = result["count"]

    return {
        "case": case_name,
        "incomplete_tasks": incomplete,
        "recently_completed": completed,
        "overdue_count": overdue_count,
        "query_date": now.strftime("%Y-%m-%d"),
    }


def get_case_events_context(case_id: int) -> dict:
    """Fetch all events for a specific case."""
    pacific = ZoneInfo("America/Los_Angeles")
    now = datetime.now(pacific)
    four_weeks = now + timedelta(weeks=4)

    with SessionLocal() as session:
        # Get case name
        row = session.execute(text("SELECT case_name FROM cases WHERE id = :case_id"), {"case_id": case_id}).mappings().first()
        case_name = row["case_name"] if row else f"Case #{case_id}"

        # Get upcoming events (next 4 weeks)
        rows = session.execute(text("""
            SELECT id, description, date, time, location
            FROM events
            WHERE case_id = :case_id AND date >= :now_date AND date <= :four_weeks
            ORDER BY date ASC
        """), {"case_id": case_id, "now_date": now.date(), "four_weeks": four_weeks.date()}).mappings().all()

        upcoming = []
        for row in rows:
            upcoming.append({
                "id": row["id"],
                "description": row["description"],
                "date": row["date"].isoformat() if row["date"] else None,
                "time": str(row["time"]) if row["time"] else None,
                "location": row["location"],
            })

        # Get past events (last 2 weeks)
        two_weeks_ago = now - timedelta(days=14)
        rows = session.execute(text("""
            SELECT id, description, date, time, location
            FROM events
            WHERE case_id = :case_id AND date >= :two_weeks_ago AND date < :now_date
            ORDER BY date DESC
        """), {"case_id": case_id, "two_weeks_ago": two_weeks_ago.date(), "now_date": now.date()}).mappings().all()

        past = []
        for row in rows:
            past.append({
                "id": row["id"],
                "description": row["description"],
                "date": row["date"].isoformat() if row["date"] else None,
                "time": str(row["time"]) if row["time"] else None,
                "location": row["location"],
            })

    return {
        "case": case_name,
        "upcoming_events": upcoming,
        "recent_past_events": past,
        "query_date": now.strftime("%Y-%m-%d"),
        "range_end": four_weeks.strftime("%Y-%m-%d"),
    }


def get_case_people_context(case_id: int) -> dict:
    """Fetch all people assigned to a specific case."""
    with SessionLocal() as session:
        # Get case name
        row = session.execute(text("SELECT case_name FROM cases WHERE id = :case_id"), {"case_id": case_id}).mappings().first()
        case_name = row["case_name"] if row else f"Case #{case_id}"

        # Get all assigned people with their roles
        rows = session.execute(text("""
            SELECT
                p.id,
                p.name,
                p.organization,
                r.name as role,
                r.category
            FROM person_roles pr
            JOIN persons p ON pr.person_id = p.id
            JOIN roles r ON pr.role_id = r.id
            WHERE pr.case_id = :case_id
            ORDER BY r.category, r.sort_order, p.name
        """), {"case_id": case_id}).mappings().all()

        people = []
        for row in rows:
            people.append({
                "id": row["id"],
                "name": row["name"],
                "organization": row["organization"],
                "role": row["role"],
                "category": row["category"],
            })

    return {
        "case": case_name,
        "people": people,
    }


# =============================================================================
# Preset configurations
# =============================================================================

# Dashboard presets (no case context)
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

Write me a status update I can give to my boss. Group accomplishments by case and summarize what was done in plain language (not a bullet list of task names). For example: "On the Martinez case, we completed discovery responses and scheduled the deposition."

Keep it conversational and highlight meaningful progress. If there's not much activity on a case, don't mention it.""",
    },
}

# Case-specific presets (require case_id)
CASE_PRESETS = {
    "case_summary": {
        "fetch": get_case_summary_context,
        "prompt": """Here's an overview of this case. Give me a concise summary:
- Current status and key dates
- Task progress and any overdue items
- Upcoming events
- Key people involved

Highlight anything that needs attention.""",
    },
    "case_next": {
        "fetch": get_case_next_steps_context,
        "prompt": """Based on the tasks, events, and overdue items, tell me what I should focus on next for this case.
Give me 3-5 actionable next steps, prioritized by urgency and upcoming deadlines.""",
    },
    "case_tasks": {
        "fetch": get_case_tasks_context,
        "prompt": """Here are the tasks for this case.
Summarize the task status - what's incomplete, what's overdue, and what was recently completed.
Highlight the most urgent items.""",
    },
    "case_events": {
        "fetch": get_case_events_context,
        "prompt": """Here are the events for this case.
Summarize the upcoming schedule and note any recent events.
Highlight anything happening soon that needs preparation.""",
    },
    "case_people": {
        "fetch": get_case_people_context,
        "prompt": """Here are the people assigned to this case.
Summarize who's involved and their roles.
Group by role type (attorneys, experts, parties, etc.).""",
    },
}


def get_preset_context(preset_id: str, case_id: int | None = None,
                       user_id: int | None = None) -> tuple[dict, str] | None:
    """Get the data context and prompt for a preset.

    Args:
        preset_id: The preset identifier
            Dashboard presets: priorities, deadlines, overdue, activity
            Case presets: case_tasks, case_events, case_people
        case_id: Required for case presets
        user_id: Logged-in user ID for scoping dashboard presets to their cases

    Returns:
        Tuple of (data_context, prompt) or None if preset not found.
    """
    # Check case-specific presets first
    if preset_id in CASE_PRESETS:
        if not case_id:
            return None
        preset = CASE_PRESETS[preset_id]
        data = preset["fetch"](case_id)
        prompt = preset["prompt"]
        return data, prompt

    # Check dashboard presets
    preset = PRESETS.get(preset_id)
    if not preset:
        return None

    data = preset["fetch"](user_id=user_id)
    prompt = preset["prompt"]
    return data, prompt
