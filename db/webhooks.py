"""
Webhook log management functions.

Stores incoming webhook events from external services (e.g., CourtListener)
for later processing.
"""

import json
from typing import Optional, List
from uuid import UUID

from .connection import get_cursor, serialize_row, serialize_rows, _NOT_PROVIDED


def create_webhook_log(
    source: str,
    payload: dict,
    event_type: str = None,
    idempotency_key: str = None,
    headers: dict = None,
    proceeding_id: int = None,
) -> Optional[dict]:
    """
    Create a new webhook log entry.

    Returns None if idempotency_key already exists (duplicate webhook).
    """
    with get_cursor() as cur:
        # Check for duplicate if idempotency_key provided
        if idempotency_key:
            cur.execute(
                "SELECT id FROM webhook_logs WHERE idempotency_key = %s",
                (idempotency_key,)
            )
            if cur.fetchone():
                return None  # Duplicate webhook

        payload_json = json.dumps(payload) if payload else '{}'
        headers_json = json.dumps(headers) if headers else '{}'

        cur.execute("""
            INSERT INTO webhook_logs (source, event_type, idempotency_key, payload, headers, proceeding_id)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, source, event_type, idempotency_key, payload, headers, proceeding_id,
                      task_id, event_id, processing_status, processing_error, created_at, processed_at
        """, (
            source,
            event_type,
            idempotency_key,
            payload_json,
            headers_json,
            proceeding_id
        ))
        row = cur.fetchone()
        return serialize_row(dict(row)) if row else None


def get_webhook_log_by_id(webhook_id: int) -> Optional[dict]:
    """Get a webhook log entry by ID."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT id, source, event_type, idempotency_key, payload, headers, proceeding_id,
                   task_id, event_id, processing_status, processing_error, created_at, processed_at
            FROM webhook_logs
            WHERE id = %s
        """, (webhook_id,))
        row = cur.fetchone()
        return serialize_row(dict(row)) if row else None


def get_webhook_log_by_idempotency_key(idempotency_key: str) -> Optional[dict]:
    """Get a webhook log entry by idempotency key."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT id, source, event_type, idempotency_key, payload, headers, proceeding_id,
                   task_id, event_id, processing_status, processing_error, created_at, processed_at
            FROM webhook_logs
            WHERE idempotency_key = %s
        """, (idempotency_key,))
        row = cur.fetchone()
        return serialize_row(dict(row)) if row else None


def get_webhook_logs(
    source: str = None,
    processing_status: str = None,
    proceeding_id: int = None,
    limit: int = 100,
    offset: int = 0,
) -> List[dict]:
    """Get webhook logs with optional filtering."""
    with get_cursor() as cur:
        conditions = []
        params = []

        if source:
            conditions.append("source = %s")
            params.append(source)

        if processing_status:
            conditions.append("processing_status = %s")
            params.append(processing_status)

        if proceeding_id:
            conditions.append("proceeding_id = %s")
            params.append(proceeding_id)

        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""

        cur.execute(f"""
            SELECT id, source, event_type, idempotency_key, payload, headers, proceeding_id,
                   task_id, event_id, processing_status, processing_error, created_at, processed_at
            FROM webhook_logs
            {where_clause}
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
        """, params + [limit, offset])

        return serialize_rows([dict(row) for row in cur.fetchall()])


def get_pending_webhook_logs(source: str = None, limit: int = 100) -> List[dict]:
    """Get pending webhook logs for processing."""
    return get_webhook_logs(source=source, processing_status="pending", limit=limit)


def update_webhook_log(
    webhook_id: int,
    processing_status: str = _NOT_PROVIDED,
    processing_error: str = _NOT_PROVIDED,
    task_id: int = _NOT_PROVIDED,
    event_id: int = _NOT_PROVIDED,
    proceeding_id: int = _NOT_PROVIDED,
) -> Optional[dict]:
    """Update a webhook log entry."""
    updates = []
    params = []

    if processing_status is not _NOT_PROVIDED:
        updates.append("processing_status = %s")
        params.append(processing_status)
        # Set processed_at when status changes to completed or failed
        if processing_status in ("completed", "failed"):
            updates.append("processed_at = CURRENT_TIMESTAMP")

    if processing_error is not _NOT_PROVIDED:
        updates.append("processing_error = %s")
        params.append(processing_error)

    if task_id is not _NOT_PROVIDED:
        updates.append("task_id = %s")
        params.append(task_id)

    if event_id is not _NOT_PROVIDED:
        updates.append("event_id = %s")
        params.append(event_id)

    if proceeding_id is not _NOT_PROVIDED:
        updates.append("proceeding_id = %s")
        params.append(proceeding_id)

    if not updates:
        return get_webhook_log_by_id(webhook_id)

    params.append(webhook_id)

    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE webhook_logs SET {', '.join(updates)}
            WHERE id = %s
            RETURNING id, source, event_type, idempotency_key, payload, headers, proceeding_id,
                      task_id, event_id, processing_status, processing_error, created_at, processed_at
        """, params)
        row = cur.fetchone()
        return serialize_row(dict(row)) if row else None


def mark_webhook_processing(webhook_id: int) -> Optional[dict]:
    """Mark a webhook as currently being processed."""
    return update_webhook_log(webhook_id, processing_status="processing")


def mark_webhook_completed(webhook_id: int, task_id: int = None, event_id: int = None) -> Optional[dict]:
    """Mark a webhook as successfully processed."""
    return update_webhook_log(
        webhook_id,
        processing_status="completed",
        task_id=task_id if task_id else _NOT_PROVIDED,
        event_id=event_id if event_id else _NOT_PROVIDED,
    )


def mark_webhook_failed(webhook_id: int, error: str) -> Optional[dict]:
    """Mark a webhook as failed with an error message."""
    return update_webhook_log(webhook_id, processing_status="failed", processing_error=error)


def idempotency_key_exists(idempotency_key: str) -> bool:
    """Check if an idempotency key already exists."""
    with get_cursor() as cur:
        cur.execute(
            "SELECT 1 FROM webhook_logs WHERE idempotency_key = %s",
            (idempotency_key,)
        )
        return cur.fetchone() is not None
