"""
Task management functions — SQLAlchemy ORM implementation.
"""

import datetime
from typing import Optional, List

from sqlalchemy import select, func, update, literal_column, exists, Integer, cast
from sqlalchemy.dialects.postgresql import ARRAY as SA_ARRAY
from sqlalchemy.orm import joinedload

from .session import SessionLocal
from .connection import _NOT_PROVIDED
from .validation import (
    validate_task_status, validate_urgency, validate_date_format
)
from models import Task, Case, Event, User
from schemas import TaskOut, UserBriefOut, TaskDetailOut


def _task_to_dict(task: Task) -> dict:
    """Convert a Task ORM instance to a serializable dict."""
    return TaskOut.model_validate(task).model_dump(mode="json")


def _assignee_dict(user: User) -> dict:
    """Build a nested assignee dict from a User."""
    return UserBriefOut.model_validate(user).model_dump(mode="json")


def _task_with_relations(task: Task, case: Case, event: Event = None,
                         assignee: User = None, has_events: bool = False) -> dict:
    """Build a full task dict with joined relations."""
    d = _task_to_dict(task)
    d["case_name"] = case.case_name if case else None
    d["short_name"] = case.short_name if case else None
    d["case_color"] = case.color if case else None
    d["event_description"] = event.description if event else None
    d["event_date"] = event.date.isoformat() if event and event.date else None
    d["has_events"] = has_events
    d["assignee"] = _assignee_dict(assignee) if assignee else None
    return d


def add_task(case_id: int, description: str, due_date: str = None,
             status: str = "Pending", urgency: str = "Medium", event_id: int = None,
             assignee_id: int = None, completion_date: str = None) -> dict:
    """Add a task to a case."""
    validate_task_status(status)
    validate_urgency(urgency)
    validate_date_format(due_date, "due_date")
    validate_date_format(completion_date, "completion_date")

    with SessionLocal() as session:
        # Get max sort_order and add 1000 for new task
        max_order = session.scalar(
            select(func.coalesce(func.max(Task.sort_order), 0))
        )
        new_sort_order = max_order + 1000

        task = Task(
            case_id=case_id,
            description=description,
            due_date=due_date,
            status=status,
            urgency=urgency,
            event_id=event_id,
            sort_order=new_sort_order,
            assignee_id=assignee_id,
        )

        # Set completion_date: use provided value, or default to today if Done
        if completion_date:
            task.completion_date = completion_date
        elif status == "Done":
            task.completion_date = datetime.date.today()

        session.add(task)
        session.flush()
        session.refresh(task)
        result = _task_to_dict(task)
        session.commit()
        return result


def get_tasks(case_id: int = None, status_filter: str = None, exclude_status: str = None,
              urgency_filter: str = None, due_date_from: str = None, due_date_to: str = None,
              limit: int = None, offset: int = None, assignee_id: int = None,
              user_id: int = None) -> dict:
    """Get tasks with optional filters."""
    # Validate filters
    if status_filter:
        validate_task_status(status_filter)
    if exclude_status:
        validate_task_status(exclude_status)
    if urgency_filter:
        validate_urgency(urgency_filter)
    if due_date_from:
        validate_date_format(due_date_from, "due_date_from")
    if due_date_to:
        validate_date_format(due_date_to, "due_date_to")

    # has_events subquery
    has_events_sq = (
        exists(select(Event.id).where(Event.case_id == Task.case_id))
        .correlate(Task)
    )

    # Build main query with all joins
    stmt = (
        select(Task, Case, Event, User, has_events_sq.label("has_events"))
        .join(Case, Task.case_id == Case.id)
        .outerjoin(Event, Task.event_id == Event.id)
        .outerjoin(User, Task.assignee_id == User.id)
        .order_by(Task.sort_order.asc())
    )

    # Apply filters
    if case_id:
        stmt = stmt.where(Task.case_id == case_id)
    if status_filter:
        stmt = stmt.where(Task.status == status_filter)
    if exclude_status:
        stmt = stmt.where(Task.status != exclude_status)
    if urgency_filter:
        stmt = stmt.where(Task.urgency == urgency_filter)
    if due_date_from:
        stmt = stmt.where(Task.due_date >= due_date_from)
    if due_date_to:
        stmt = stmt.where(Task.due_date <= due_date_to)
    if assignee_id:
        stmt = stmt.where(Task.assignee_id == assignee_id)
    if user_id:
        uid_arr = cast([user_id], SA_ARRAY(Integer()))
        stmt = stmt.where(
            Case.attorney_ids.op('@>')(uid_arr)
            | Case.paralegal_ids.op('@>')(uid_arr)
        )

    with SessionLocal() as session:
        # Count query with same filters
        count_base = select(Task.id).join(Case, Task.case_id == Case.id)
        if case_id:
            count_base = count_base.where(Task.case_id == case_id)
        if status_filter:
            count_base = count_base.where(Task.status == status_filter)
        if exclude_status:
            count_base = count_base.where(Task.status != exclude_status)
        if urgency_filter:
            count_base = count_base.where(Task.urgency == urgency_filter)
        if due_date_from:
            count_base = count_base.where(Task.due_date >= due_date_from)
        if due_date_to:
            count_base = count_base.where(Task.due_date <= due_date_to)
        if assignee_id:
            count_base = count_base.where(Task.assignee_id == assignee_id)
        if user_id:
            uid_arr = cast([user_id], SA_ARRAY(Integer()))
            count_base = count_base.where(
                Case.attorney_ids.op('@>')(uid_arr)
                | Case.paralegal_ids.op('@>')(uid_arr)
            )
        total = session.scalar(select(func.count()).select_from(count_base.subquery()))

        if limit:
            stmt = stmt.limit(limit)
        if offset:
            stmt = stmt.offset(offset)

        rows = session.execute(stmt).all()
        tasks = [
            _task_with_relations(task, case, event, assignee, has_ev)
            for task, case, event, assignee, has_ev in rows
        ]
        return {"tasks": tasks, "total": total}


def update_task(task_id: int, status: str = None, urgency: str = None) -> Optional[dict]:
    """Update task status and/or urgency."""
    if not status and not urgency:
        return None

    if status:
        validate_task_status(status)
    if urgency:
        validate_urgency(urgency)

    with SessionLocal() as session:
        task = session.get(Task, task_id)
        if not task:
            return None

        if status:
            task.status = status
            if status == "Done":
                task.completion_date = datetime.date.today()

        if urgency:
            task.urgency = urgency

        session.flush()
        session.refresh(task)
        result = _task_to_dict(task)
        session.commit()
        return result


def update_task_full(task_id: int, description: str = _NOT_PROVIDED, due_date: str = _NOT_PROVIDED,
                     completion_date: str = _NOT_PROVIDED, status: str = _NOT_PROVIDED,
                     urgency: str = _NOT_PROVIDED, event_id: int = _NOT_PROVIDED,
                     assignee_id: int = _NOT_PROVIDED) -> Optional[dict]:
    """Update all task fields."""
    fields = [description, due_date, completion_date, status, urgency, event_id, assignee_id]
    if all(f is _NOT_PROVIDED for f in fields):
        return None

    with SessionLocal() as session:
        task = session.get(Task, task_id)
        if not task:
            return None

        if description is not _NOT_PROVIDED:
            task.description = description

        if due_date is not _NOT_PROVIDED:
            if due_date is not None and due_date != "":
                validate_date_format(due_date, "due_date")
            task.due_date = due_date if due_date else None

        if completion_date is not _NOT_PROVIDED:
            if completion_date is not None and completion_date != "":
                validate_date_format(completion_date, "completion_date")
            task.completion_date = completion_date if completion_date else None

        if status is not _NOT_PROVIDED:
            if status is not None:
                validate_task_status(status)
            task.status = status
            # Auto-set completion_date when marking as Done (if not explicitly provided)
            if status == "Done" and completion_date is _NOT_PROVIDED:
                task.completion_date = datetime.date.today()
            # Clear completion_date when unmarking from Done (if not explicitly provided)
            elif status is not None and status != "Done" and completion_date is _NOT_PROVIDED:
                task.completion_date = None

        if urgency is not _NOT_PROVIDED:
            if urgency is not None:
                validate_urgency(urgency)
            task.urgency = urgency

        if event_id is not _NOT_PROVIDED:
            task.event_id = event_id

        if assignee_id is not _NOT_PROVIDED:
            task.assignee_id = assignee_id

        session.flush()
        session.refresh(task)
        result = _task_to_dict(task)

        # Fetch assignee info if set
        if task.assignee_id:
            assignee = session.get(User, task.assignee_id)
            if assignee:
                result["assignee"] = _assignee_dict(assignee)
            else:
                result["assignee"] = None
        else:
            result["assignee"] = None

        session.commit()
        return result


def delete_task(task_id: int) -> bool:
    """Delete a task."""
    with SessionLocal() as session:
        task = session.get(Task, task_id)
        if not task:
            return False
        session.delete(task)
        session.commit()
        return True


def bulk_update_tasks(task_ids: List[int], status: str) -> dict:
    """Update status for multiple tasks."""
    validate_task_status(status)
    with SessionLocal() as session:
        values = {"status": status}
        if status == "Done":
            values["completion_date"] = datetime.date.today()
        else:
            values["completion_date"] = None

        stmt = update(Task).where(Task.id.in_(task_ids)).values(**values)
        result = session.execute(stmt)
        session.commit()
        return {"updated": result.rowcount}


def bulk_update_tasks_for_case(case_id: int, status: str, current_status: str = None) -> dict:
    """Update all tasks for a case, optionally filtering by current status."""
    validate_task_status(status)
    if current_status:
        validate_task_status(current_status)

    with SessionLocal() as session:
        values = {"status": status}
        if status == "Done":
            values["completion_date"] = datetime.date.today()
        else:
            values["completion_date"] = None

        stmt = update(Task).where(Task.case_id == case_id)
        if current_status:
            stmt = stmt.where(Task.status == current_status)
        stmt = stmt.values(**values)

        result = session.execute(stmt)
        session.commit()
        return {"updated": result.rowcount}


def reschedule_overdue_tasks(new_date: str, task_ids: List[int] = None) -> dict:
    """Reschedule overdue incomplete tasks to a new date.

    If task_ids is provided, only those tasks are updated (scoped to the user's
    current view).  Otherwise all overdue incomplete tasks are updated.
    """
    validate_date_format(new_date, "new_date")

    with SessionLocal() as session:
        stmt = (
            update(Task)
            .where(Task.due_date < func.current_date(), Task.status != "Done")
            .values(due_date=new_date)
        )
        if task_ids:
            stmt = stmt.where(Task.id.in_(task_ids))
        result = session.execute(stmt)
        session.commit()
        return {"updated": result.rowcount}


def search_tasks(query: str = None, case_id: int = None, status: str = None,
                 urgency: str = None, assignee_id: int = None, limit: int = 50,
                 user_id: int = None, due_date_before: str = None,
                 due_date_after: str = None) -> List[dict]:
    """Search tasks by various criteria."""
    if status:
        validate_task_status(status)
    if urgency:
        validate_urgency(urgency)
    if due_date_before:
        validate_date_format(due_date_before, "due_date_before")
    if due_date_after:
        validate_date_format(due_date_after, "due_date_after")

    has_events_sq = (
        exists(select(Event.id).where(Event.case_id == Task.case_id))
        .correlate(Task)
    )

    stmt = (
        select(Task, Case, Event, User, has_events_sq.label("has_events"))
        .join(Case, Task.case_id == Case.id)
        .outerjoin(Event, Task.event_id == Event.id)
        .outerjoin(User, Task.assignee_id == User.id)
        .order_by(Task.sort_order.asc())
        .limit(limit)
    )

    if query:
        stmt = stmt.where(Task.description.ilike(f"%{query}%"))
    if case_id:
        stmt = stmt.where(Task.case_id == case_id)
    if status:
        stmt = stmt.where(Task.status == status)
    if urgency:
        stmt = stmt.where(Task.urgency == urgency)
    if assignee_id:
        stmt = stmt.where(Task.assignee_id == assignee_id)
    if user_id:
        uid_arr = cast([user_id], SA_ARRAY(Integer()))
        stmt = stmt.where(
            Case.attorney_ids.op('@>')(uid_arr)
            | Case.paralegal_ids.op('@>')(uid_arr)
        )
    if due_date_before:
        stmt = stmt.where(Task.due_date <= due_date_before)
    if due_date_after:
        stmt = stmt.where(Task.due_date >= due_date_after)

    with SessionLocal() as session:
        rows = session.execute(stmt).all()
        return [
            _task_with_relations(task, case, event, assignee, has_ev)
            for task, case, event, assignee, has_ev in rows
        ]


def get_task_detail(task_id: int) -> Optional[dict]:
    """Get a single task with case and assignee info for the detail view."""
    with SessionLocal() as session:
        stmt = (
            select(Task, Case, User)
            .join(Case, Task.case_id == Case.id)
            .outerjoin(User, Task.assignee_id == User.id)
            .where(Task.id == task_id)
        )
        row = session.execute(stmt).first()
        if not row:
            return None
        task, case, user = row
        return TaskDetailOut(
            id=task.id, case_id=task.case_id,
            case_name=case.case_name, short_name=case.short_name,
            description=task.description,
            due_date=task.due_date, completion_date=task.completion_date,
            status=task.status, urgency=task.urgency,
            event_id=task.event_id, sort_order=task.sort_order,
            assignee_id=task.assignee_id,
            assignee_first_name=user.first_name if user else None,
            assignee_last_name=user.last_name if user else None,
            assignee_initials=user.initials if user else None,
        ).model_dump(mode="json")


def reorder_task(task_id: int, new_sort_order: int, new_urgency: str = None) -> Optional[dict]:
    """Reorder a task and optionally change its urgency."""
    if new_urgency is not None:
        validate_urgency(new_urgency)

    with SessionLocal() as session:
        task = session.get(Task, task_id)
        if not task:
            return None

        task.sort_order = new_sort_order
        if new_urgency is not None:
            task.urgency = new_urgency

        session.flush()
        session.refresh(task)
        result = _task_to_dict(task)
        session.commit()
        return result
