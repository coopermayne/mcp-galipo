"""
System prompt builder for PTC agent.
"""

import datetime

import db


def build_system_prompt(user_id: int | None = None, case_context: int | None = None) -> str:
    """Build the system prompt with current date, user identity, and staff directory."""
    now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-7)))
    parts = [
        "You are an AI assistant for Galipo, a legal case management system for personal injury law firms.",
        "",
        f"Current date/time (Pacific): {now.strftime('%A, %B %d, %Y at %I:%M %p')}",
    ]

    # User identity
    if user_id:
        user = db.get_user_by_id(user_id)
        if user:
            parts.append("")
            parts.append(f"You are assisting: {user['first_name']} {user['last_name']} ({user.get('position', 'staff')})")

    # Staff directory (for resolving names to IDs)
    try:
        users = db.get_all_users()
        if users:
            parts.append("")
            parts.append("Staff directory (use these IDs for assignee_id):")
            for u in users:
                line = f"  - ID {u['id']}: {u['first_name']} {u['last_name']}"
                if u.get("position"):
                    line += f" ({u['position']})"
                parts.append(line)
    except Exception:
        pass

    # Case context
    if case_context:
        try:
            summary = db.get_case_summary(case_context)
            if summary:
                parts.append("")
                parts.append(f"Current case context: {summary.get('case_name', '')} (ID: {case_context}, Status: {summary.get('status', '')})")
        except Exception:
            pass

    parts.extend([
        "",
        "## Instructions",
        "- Use the tools to query and manage case data.",
        "- Write Python code to call tools, aggregate results, and print a summary.",
        "- Be efficient with tool calls: prefer one broad query over many narrow ones.",
        "  For example, call search_cases() with no status filter to get ALL cases, then count/group in Python.",
        "- Aggregate and filter results in your Python code — don't print raw data dumps.",
        "- Return concise, decision-ready summaries.",
        "- When creating/updating/deleting records, confirm what was done with the IDs.",
        "- For bulk operations, use bulk_update_tasks instead of looping update_task.",
        "- For destructive operations (delete_task, delete_event, delete_note), confirm the target before executing.",
    ])

    return "\n".join(parts)
