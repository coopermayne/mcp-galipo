"""
Webhook receiver routes.

Handles incoming webhooks from external services like CourtListener.
No session authentication required - uses token-based validation.
"""

import os
from fastapi.responses import JSONResponse

import auth
import database as db
from .common import api_error


# Webhook secrets from environment variables
WEBHOOK_SECRET_COURTLISTENER = os.environ.get("WEBHOOK_SECRET_COURTLISTENER", "")


def register_webhook_routes(mcp):
    """Register webhook receiver routes."""

    @mcp.custom_route("/api/v1/webhooks", methods=["GET"])
    async def list_webhooks(request):
        """List all webhook logs with optional filtering."""
        if err := auth.require_auth(request):
            return err

        source = request.query_params.get("source")
        status = request.query_params.get("status")
        limit = int(request.query_params.get("limit", "100"))
        offset = int(request.query_params.get("offset", "0"))

        webhooks = db.get_webhook_logs(
            source=source,
            processing_status=status,
            limit=limit,
            offset=offset,
        )
        return JSONResponse({"webhooks": webhooks})

    @mcp.custom_route("/api/v1/webhooks/{webhook_id}", methods=["GET"])
    async def get_webhook(request):
        """Get a single webhook log by ID."""
        if err := auth.require_auth(request):
            return err

        webhook_id = int(request.path_params["webhook_id"])
        webhook = db.get_webhook_log_by_id(webhook_id)

        if not webhook:
            return api_error("Webhook not found", "NOT_FOUND", 404)

        return JSONResponse({"webhook": webhook})

    @mcp.custom_route("/api/v1/webhooks/courtlistener/{token}", methods=["POST"])
    async def receive_courtlistener_webhook(request):
        """
        Receive webhooks from CourtListener.

        CourtListener sends webhook events for:
        - Docket alerts (new filings on subscribed cases)
        - Search alerts (new results matching saved searches)
        - Old docket alerts (stale alert notifications)
        - RECAP fetch completion
        - Pray and pay grants

        The webhook is stored for later processing. Returns 200 immediately.
        No session auth - validated by secret token in URL.
        """
        # Validate token
        token = request.path_params.get("token", "")
        if not WEBHOOK_SECRET_COURTLISTENER:
            return api_error(
                "Webhook endpoint not configured",
                "WEBHOOK_NOT_CONFIGURED",
                500
            )

        if token != WEBHOOK_SECRET_COURTLISTENER:
            return api_error("Invalid webhook token", "UNAUTHORIZED", 401)

        # Extract idempotency key from headers (CourtListener sends this)
        idempotency_key = request.headers.get("idempotency-key")

        # Parse webhook payload first (before any DB operations)
        try:
            payload = await request.json()
        except Exception:
            return api_error("Invalid JSON payload", "INVALID_PAYLOAD", 400)

        try:
            # Check for duplicate if idempotency key provided
            if idempotency_key and db.idempotency_key_exists(idempotency_key):
                # Return 200 OK for duplicates (idempotent behavior)
                return JSONResponse({"success": True, "duplicate": True})

            # Extract event type from payload if available
            # CourtListener webhooks have a "webhook" key with metadata
            event_type = None
            webhook_meta = payload.get("webhook", {})
            if isinstance(webhook_meta, dict):
                event_type = webhook_meta.get("event_type")

            # Capture headers for debugging (exclude sensitive ones)
            headers_to_store = {
                "content-type": request.headers.get("content-type"),
                "idempotency-key": idempotency_key,
                "user-agent": request.headers.get("user-agent"),
            }

            # Store the webhook for later processing
            result = db.create_webhook_log(
                source="courtlistener",
                payload=payload,
                event_type=event_type,
                idempotency_key=idempotency_key,
                headers=headers_to_store,
            )

            if result is None:
                # Duplicate (idempotency key exists) - return 200 OK
                return JSONResponse({"success": True, "duplicate": True})

            # Return 200 immediately (webhook will be processed asynchronously)
            return JSONResponse({"success": True, "id": result["id"]})

        except Exception as e:
            # Log error but still return 200 to prevent CourtListener retries
            # The webhook data is in the request, we can debug from logs
            import logging
            logging.error(f"Webhook processing error: {e}")
            return api_error(f"Database error: {str(e)}", "DATABASE_ERROR", 500)
