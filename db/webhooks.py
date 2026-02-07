"""
Webhook log management functions — SQLAlchemy ORM implementation.

Stores incoming webhook events from external services (e.g., CourtListener)
for later processing.
"""

from typing import Optional, List

from sqlalchemy import select, func

from .session import SessionLocal
from models import WebhookLog
from schemas import WebhookOut


# Sentinel value to distinguish "not provided" from None
_NOT_PROVIDED = object()


def _webhook_to_dict(wh: WebhookLog) -> dict:
    """Convert a WebhookLog ORM object to a JSON-safe dict."""
    return WebhookOut.model_validate(wh).model_dump(mode="json")


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
    with SessionLocal() as session:
        if idempotency_key:
            existing = session.scalars(
                select(WebhookLog).where(
                    WebhookLog.idempotency_key == idempotency_key
                )
            ).first()
            if existing:
                return None

        wh = WebhookLog(
            source=source,
            payload=payload or {},
            event_type=event_type,
            idempotency_key=idempotency_key,
            headers=headers or {},
            proceeding_id=proceeding_id,
        )
        session.add(wh)
        session.flush()
        session.refresh(wh)
        result = _webhook_to_dict(wh)
        session.commit()
        return result


def get_webhook_log_by_id(webhook_id: int) -> Optional[dict]:
    """Get a webhook log entry by ID."""
    with SessionLocal() as session:
        wh = session.get(WebhookLog, webhook_id)
        return _webhook_to_dict(wh) if wh else None


def get_webhook_log_by_idempotency_key(idempotency_key: str) -> Optional[dict]:
    """Get a webhook log entry by idempotency key."""
    with SessionLocal() as session:
        wh = session.scalars(
            select(WebhookLog).where(
                WebhookLog.idempotency_key == idempotency_key
            )
        ).first()
        return _webhook_to_dict(wh) if wh else None


def get_webhook_logs(
    source: str = None,
    processing_status: str = None,
    proceeding_id: int = None,
    limit: int = 100,
    offset: int = 0,
) -> List[dict]:
    """Get webhook logs with optional filtering."""
    with SessionLocal() as session:
        stmt = select(WebhookLog)

        if source:
            stmt = stmt.where(WebhookLog.source == source)
        if processing_status:
            stmt = stmt.where(WebhookLog.processing_status == processing_status)
        if proceeding_id:
            stmt = stmt.where(WebhookLog.proceeding_id == proceeding_id)

        stmt = stmt.order_by(WebhookLog.created_at.desc()).limit(limit).offset(offset)
        webhooks = session.scalars(stmt).all()
        return [_webhook_to_dict(wh) for wh in webhooks]


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
    with SessionLocal() as session:
        wh = session.get(WebhookLog, webhook_id)
        if not wh:
            return None

        if processing_status is not _NOT_PROVIDED:
            wh.processing_status = processing_status
            if processing_status in ("completed", "failed"):
                wh.processed_at = func.now()

        if processing_error is not _NOT_PROVIDED:
            wh.processing_error = processing_error
        if task_id is not _NOT_PROVIDED:
            wh.task_id = task_id
        if event_id is not _NOT_PROVIDED:
            wh.event_id = event_id
        if proceeding_id is not _NOT_PROVIDED:
            wh.proceeding_id = proceeding_id

        session.flush()
        session.refresh(wh)
        result = _webhook_to_dict(wh)
        session.commit()
        return result


def mark_webhook_processing(webhook_id: int) -> Optional[dict]:
    """Mark a webhook as currently being processed."""
    return update_webhook_log(webhook_id, processing_status="processing")


def mark_webhook_completed(
    webhook_id: int, task_id: int = None, event_id: int = None
) -> Optional[dict]:
    """Mark a webhook as successfully processed."""
    return update_webhook_log(
        webhook_id,
        processing_status="completed",
        task_id=task_id if task_id else _NOT_PROVIDED,
        event_id=event_id if event_id else _NOT_PROVIDED,
    )


def mark_webhook_failed(webhook_id: int, error: str) -> Optional[dict]:
    """Mark a webhook as failed with an error message."""
    return update_webhook_log(
        webhook_id, processing_status="failed", processing_error=error
    )


def idempotency_key_exists(idempotency_key: str) -> bool:
    """Check if an idempotency key already exists."""
    with SessionLocal() as session:
        count = session.scalar(
            select(func.count())
            .select_from(WebhookLog)
            .where(WebhookLog.idempotency_key == idempotency_key)
        )
        return count > 0


def delete_webhook_log(webhook_id: int) -> bool:
    """Delete a webhook log entry. Returns True if deleted, False if not found."""
    with SessionLocal() as session:
        wh = session.get(WebhookLog, webhook_id)
        if not wh:
            return False
        session.delete(wh)
        session.commit()
        return True
