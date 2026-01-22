"""
Task management functions.
"""

from typing import Optional, List

from .connection import get_cursor, serialize_row, serialize_rows, _NOT_PROVIDED
from .validation import (
    validate_task_status, validate_urgency, validate_date_format
)


def add_task(case_id: int, description: str, due_date: str = None,
             status: str = "Pending", urgency: int = 2, event_id: int = None) -> dict:
    """Add a task to a case."""
    validate_task_status(status)
    validate_urgency(urgency)
    validate_date_format(due_date, "due_date")

    with get_cursor() as cur:
        # Get max sort_order and add 1000 for new task
        cur.execute("SELECT COALESCE(MAX(sort_order), 0) + 1000 AS next_sort_order FROM tasks")
        new_sort_order = cur.fetchone()["next_sort_order"]

        cur.execute("""
            INSERT INTO tasks (case_id, description, due_date, status, urgency, event_id, sort_order)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id, case_id, description, due_date, completion_date, status, urgency, event_id, sort_order, created_at
        """, (case_id, description, due_date, status, urgency, event_id, new_sort_order))
        return serialize_row(dict(cur.fetchone()))


def get_tasks(case_id: int = None, status_filter: str = None,
              urgency_filter: int = None, limit: int = None, offset: int = None) -> dict:
    """Get tasks with optional filters."""
    conditions = []
    params = []

    if case_id:
        conditions.append("t.case_id = %s")
        params.append(case_id)

    if status_filter:
        validate_task_status(status_filter)
        conditions.append("t.status = %s")
        params.append(status_filter)

    if urgency_filter:
        validate_urgency(urgency_filter)
        conditions.append("t.urgency = %s")
        params.append(urgency_filter)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with get_cursor() as cur:
        cur.execute(f"SELECT COUNT(*) as total FROM tasks t {where_clause}", params)
        total = cur.fetchone()["total"]

        query = f"""
            SELECT t.id, t.case_id, c.case_name, c.short_name, t.description,
                   t.due_date, t.completion_date, t.status, t.urgency, t.event_id, t.sort_order, t.created_at
            FROM tasks t
            JOIN cases c ON t.case_id = c.id
            {where_clause}
            ORDER BY t.sort_order ASC
        """
        if limit:
            query += f" LIMIT {limit}"
        if offset:
            query += f" OFFSET {offset}"

        cur.execute(query, params)
        return {"tasks": serialize_rows([dict(row) for row in cur.fetchall()]), "total": total}


def update_task(task_id: int, status: str = None, urgency: int = None) -> Optional[dict]:
    """Update task status and/or urgency."""
    updates = []
    params = []

    if status:
        validate_task_status(status)
        updates.append("status = %s")
        params.append(status)
        # Auto-set completion_date when marking as Done
        if status == "Done":
            updates.append("completion_date = CURRENT_DATE")

    if urgency:
        validate_urgency(urgency)
        updates.append("urgency = %s")
        params.append(urgency)

    if not updates:
        return None

    params.append(task_id)

    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE tasks SET {', '.join(updates)}
            WHERE id = %s
            RETURNING id, case_id, description, due_date, completion_date, status, urgency, event_id, sort_order, created_at
        """, params)
        row = cur.fetchone()
        return serialize_row(dict(row)) if row else None


def update_task_full(task_id: int, description: str = _NOT_PROVIDED, due_date: str = _NOT_PROVIDED,
                     completion_date: str = _NOT_PROVIDED, status: str = _NOT_PROVIDED,
                     urgency: int = _NOT_PROVIDED) -> Optional[dict]:
    """Update all task fields."""
    updates = []
    params = []

    if description is not _NOT_PROVIDED:
        updates.append("description = %s")
        params.append(description)

    if due_date is not _NOT_PROVIDED:
        if due_date is not None and due_date != "":
            validate_date_format(due_date, "due_date")
        updates.append("due_date = %s")
        params.append(due_date if due_date else None)

    if completion_date is not _NOT_PROVIDED:
        if completion_date is not None and completion_date != "":
            validate_date_format(completion_date, "completion_date")
        updates.append("completion_date = %s")
        params.append(completion_date if completion_date else None)

    if status is not _NOT_PROVIDED:
        if status is not None:
            validate_task_status(status)
        updates.append("status = %s")
        params.append(status)

    if urgency is not _NOT_PROVIDED:
        if urgency is not None:
            validate_urgency(urgency)
        updates.append("urgency = %s")
        params.append(urgency)

    if not updates:
        return None

    params.append(task_id)

    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE tasks SET {', '.join(updates)}
            WHERE id = %s
            RETURNING id, case_id, description, due_date, completion_date, status, urgency, event_id, sort_order, created_at
        """, params)
        row = cur.fetchone()
        return serialize_row(dict(row)) if row else None


def delete_task(task_id: int) -> bool:
    """Delete a task."""
    with get_cursor() as cur:
        cur.execute("DELETE FROM tasks WHERE id = %s", (task_id,))
        return cur.rowcount > 0


def bulk_update_tasks(task_ids: List[int], status: str) -> dict:
    """Update status for multiple tasks."""
    validate_task_status(status)
    with get_cursor() as cur:
        cur.execute("""
            UPDATE tasks SET status = %s
            WHERE id = ANY(%s)
        """, (status, task_ids))
        return {"updated": cur.rowcount}


def bulk_update_tasks_for_case(case_id: int, status: str, current_status: str = None) -> dict:
    """Update all tasks for a case, optionally filtering by current status."""
    validate_task_status(status)
    with get_cursor() as cur:
        if current_status:
            validate_task_status(current_status)
            cur.execute("""
                UPDATE tasks SET status = %s
                WHERE case_id = %s AND status = %s
            """, (status, case_id, current_status))
        else:
            cur.execute("""
                UPDATE tasks SET status = %s
                WHERE case_id = %s
            """, (status, case_id))
        return {"updated": cur.rowcount}


def search_tasks(query: str = None, case_id: int = None, status: str = None,
                 urgency: int = None, limit: int = 50) -> List[dict]:
    """Search tasks by various criteria."""
    conditions = []
    params = []

    if query:
        conditions.append("t.description ILIKE %s")
        params.append(f"%{query}%")

    if case_id:
        conditions.append("t.case_id = %s")
        params.append(case_id)

    if status:
        validate_task_status(status)
        conditions.append("t.status = %s")
        params.append(status)

    if urgency:
        validate_urgency(urgency)
        conditions.append("t.urgency = %s")
        params.append(urgency)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with get_cursor() as cur:
        cur.execute(f"""
            SELECT t.id, t.case_id, c.case_name, c.short_name, t.description,
                   t.due_date, t.completion_date, t.status, t.urgency, t.sort_order
            FROM tasks t
            JOIN cases c ON t.case_id = c.id
            {where_clause}
            ORDER BY t.sort_order ASC
            LIMIT %s
        """, params + [limit])
        return [dict(row) for row in cur.fetchall()]


def reorder_task(task_id: int, new_sort_order: int, new_urgency: int = None) -> Optional[dict]:
    """Reorder a task and optionally change its urgency.

    Args:
        task_id: The ID of the task to reorder
        new_sort_order: The new sort_order value
        new_urgency: Optional new urgency level (1-4)

    Returns:
        The updated task with new sort_order (and urgency if changed)
    """
    updates = ["sort_order = %s"]
    params = [new_sort_order]

    if new_urgency is not None:
        validate_urgency(new_urgency)
        updates.append("urgency = %s")
        params.append(new_urgency)

    params.append(task_id)

    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE tasks SET {', '.join(updates)}
            WHERE id = %s
            RETURNING id, case_id, description, due_date, completion_date, status, urgency, event_id, sort_order, created_at
        """, params)
        row = cur.fetchone()
        return serialize_row(dict(row)) if row else None
