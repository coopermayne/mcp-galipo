"""
Webhook log management functions — SQLAlchemy ORM implementation.

Stores incoming webhook events from external services (e.g., CourtListener)
for later processing.
"""

from typing import Optional, List

from sqlalchemy import select, func

from .session import SessionLocal
from models import WebhookLog, Proceeding, Case
from schemas import WebhookOut


# Sentinel value to distinguish "not provided" from None
_NOT_PROVIDED = object()


def _webhook_to_dict(wh: WebhookLog) -> dict:
    """Convert a WebhookLog ORM object to a JSON-safe dict."""
    return WebhookOut.model_validate(wh).model_dump(mode="json")


def _attach_case_context(session, dicts: List[dict]) -> List[dict]:
    """Fill in linked case context (case_id/name/number) for webhooks that are
    linked to a proceeding. Resolved via proceeding -> case in one query."""
    proc_ids = {d["proceeding_id"] for d in dicts if d.get("proceeding_id")}
    if not proc_ids:
        return dicts

    rows = session.execute(
        select(Proceeding.id, Proceeding.case_number, Case.id, Case.case_name)
        .join(Case, Case.id == Proceeding.case_id, isouter=True)
        .where(Proceeding.id.in_(proc_ids))
    ).all()
    by_proc = {
        r[0]: {"case_number": r[1], "case_id": r[2], "case_name": r[3]} for r in rows
    }
    for d in dicts:
        ctx = by_proc.get(d.get("proceeding_id"))
        if ctx:
            d["case_id"] = ctx["case_id"]
            d["case_name"] = ctx["case_name"]
            d["case_number"] = ctx["case_number"]
    return dicts


def _payload_docket_expr():
    """SQLAlchemy expression for the docket id buried in a CourtListener payload:
    payload -> payload -> results -> [0] -> docket. Returns text; NULL if absent."""
    return WebhookLog.payload["payload"]["results"][0]["docket"].astext


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
        if not wh:
            return None
        return _attach_case_context(session, [_webhook_to_dict(wh)])[0]


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
        return _attach_case_context(session, [_webhook_to_dict(wh) for wh in webhooks])


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


def link_webhook_to_proceeding(
    webhook_id: int,
    proceeding_id: int,
    docket_id: int = None,
    link_siblings: bool = False,
) -> Optional[dict]:
    """Link a CourtListener webhook to a proceeding and mark it completed.

    If ``link_siblings`` and ``docket_id`` are provided, every other CourtListener
    webhook carrying the same docket id is linked to the same proceeding too.
    When ``docket_id`` is given, it is also stamped onto the proceeding (if not
    already set) so the docket<->proceeding association is recorded.

    Returns {"linked_ids": [...], "count": N} or None if the webhook is missing.
    """
    with SessionLocal() as session:
        wh = session.get(WebhookLog, webhook_id)
        if not wh:
            return None

        targets = [wh]
        if link_siblings and docket_id is not None:
            siblings = session.scalars(
                select(WebhookLog).where(
                    WebhookLog.source == "courtlistener",
                    WebhookLog.id != webhook_id,
                    _payload_docket_expr() == str(docket_id),
                )
            ).all()
            targets.extend(siblings)

        linked_ids = []
        for t in targets:
            t.proceeding_id = proceeding_id
            t.processing_status = "completed"
            t.processed_at = func.now()
            linked_ids.append(t.id)

        session.commit()

    # Stamp the docket id onto the proceeding if it doesn't have one yet.
    if docket_id is not None:
        from .proceedings import get_proceeding_by_id, update_proceeding

        proc = get_proceeding_by_id(proceeding_id)
        if proc and not proc.get("courtlistener_docket_id"):
            update_proceeding(proceeding_id, courtlistener_docket_id=docket_id)

    return {"linked_ids": linked_ids, "count": len(linked_ids)}


def unlink_webhook(webhook_id: int) -> Optional[dict]:
    """Unlink a webhook from its proceeding and return it to pending status."""
    return update_webhook_log(
        webhook_id, proceeding_id=None, processing_status="pending"
    )
