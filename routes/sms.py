"""
SMS messaging API routes.

Endpoints for listing conversations, viewing messages, sending SMS via Twilio,
and receiving inbound messages via Twilio webhook.
"""

import asyncio
import logging

from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import ValidationError

import auth
import db
from config import settings
from .common import api_error
from .sse import broadcast

logger = logging.getLogger(__name__)


def _get_twilio_client():
    """Lazy-load Twilio client only when needed."""
    if not settings.twilio_account_sid or not settings.twilio_auth_token:
        return None
    from twilio.rest import Client
    return Client(settings.twilio_account_sid, settings.twilio_auth_token)


def _validate_twilio_signature(request, body_params: dict) -> bool:
    """Validate that the request came from Twilio."""
    if not settings.twilio_auth_token:
        logger.warning("No Twilio auth token configured, skipping signature validation")
        return False
    from twilio.request_validator import RequestValidator
    validator = RequestValidator(settings.twilio_auth_token)

    # Build the full URL from the request
    url = str(request.url)
    signature = request.headers.get("X-Twilio-Signature", "")

    return validator.validate(url, body_params, signature)


def register_sms_routes(mcp):
    """Register SMS messaging routes."""

    @mcp.custom_route("/api/v1/sms/conversations", methods=["GET"])
    async def api_list_conversations(request):
        """List SMS conversations sorted by most recent."""
        if err := auth.require_auth(request):
            return err

        limit = int(request.query_params.get("limit", "50"))
        offset = int(request.query_params.get("offset", "0"))

        result = await asyncio.to_thread(
            db.list_sms_conversations, limit=limit, offset=offset
        )
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/sms/conversations/{conversation_id}/messages", methods=["GET"])
    async def api_get_messages(request):
        """Get messages for a conversation."""
        if err := auth.require_auth(request):
            return err

        conversation_id = int(request.path_params["conversation_id"])
        limit = int(request.query_params.get("limit", "100"))
        offset = int(request.query_params.get("offset", "0"))

        result = await asyncio.to_thread(
            db.get_sms_messages,
            conversation_id=conversation_id,
            limit=limit,
            offset=offset,
        )
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/sms/conversations", methods=["POST"])
    async def api_create_conversation(request):
        """Start a new SMS conversation."""
        if err := auth.require_auth(request):
            return err

        user = auth.get_current_user(request)
        user_id = user["id"] if user else None

        try:
            body = await request.json()
        except Exception:
            return api_error("Invalid JSON body", "BAD_REQUEST", 400)

        phone_number = body.get("phone_number", "").strip()
        if not phone_number:
            return api_error("phone_number is required", "VALIDATION_ERROR", 400)

        label = body.get("label", "").strip() or None

        result = await asyncio.to_thread(
            db.find_or_create_sms_conversation,
            phone_number=phone_number,
            label=label,
        )

        if result.get("created"):
            broadcast({
                "entity": "sms_conversation",
                "action": "created",
                "id": result["id"],
                "user_id": user_id,
            })

        return JSONResponse(result, status_code=201 if result.get("created") else 200)

    @mcp.custom_route("/api/v1/sms/messages", methods=["POST"])
    async def api_send_message(request):
        """Send an outbound SMS message."""
        if err := auth.require_auth(request):
            return err

        user = auth.get_current_user(request)
        user_id = user["id"] if user else None

        try:
            body = await request.json()
        except Exception:
            return api_error("Invalid JSON body", "BAD_REQUEST", 400)

        conversation_id = body.get("conversation_id")
        message_body = body.get("body", "").strip()

        if not conversation_id:
            return api_error("conversation_id is required", "VALIDATION_ERROR", 400)
        if not message_body:
            return api_error("body is required", "VALIDATION_ERROR", 400)

        # Get conversation to find the phone number
        conv = await asyncio.to_thread(db.get_sms_conversation, conversation_id)
        if not conv:
            return api_error("Conversation not found", "NOT_FOUND", 404)

        # Send via Twilio
        twilio_sid = None
        status = "sent"
        client = _get_twilio_client()
        if client and settings.twilio_phone_number:
            try:
                twilio_msg = client.messages.create(
                    body=message_body,
                    from_=settings.twilio_phone_number,
                    to=conv["phone_number"],
                )
                twilio_sid = twilio_msg.sid
            except Exception as e:
                logger.error("Twilio send failed: %s", e)
                status = "failed"
        else:
            logger.warning("Twilio not configured — message saved but not sent")

        # Save to database
        msg = await asyncio.to_thread(
            db.create_sms_message,
            conversation_id=conversation_id,
            direction="outbound",
            body=message_body,
            twilio_sid=twilio_sid,
            sent_by_user_id=user_id,
            status=status,
        )

        if not msg:
            return api_error("Failed to save message", "SERVER_ERROR", 500)

        broadcast({
            "entity": "sms_message",
            "action": "created",
            "id": msg["id"],
            "conversation_id": conversation_id,
            "user_id": user_id,
        })

        return JSONResponse(msg, status_code=201)

    @mcp.custom_route("/api/v1/sms/webhook", methods=["POST"])
    async def api_twilio_webhook(request):
        """Receive inbound SMS from Twilio.

        No auth — validated via Twilio request signature.
        Returns TwiML (empty) response.
        """
        # Parse form data (Twilio sends application/x-www-form-urlencoded)
        form = await request.form()
        body_params = dict(form)

        # Validate Twilio signature
        if settings.twilio_auth_token:
            if not _validate_twilio_signature(request, body_params):
                logger.warning("Invalid Twilio signature on SMS webhook")
                return PlainTextResponse("Forbidden", status_code=403)

        from_number = body_params.get("From", "")
        message_body = body_params.get("Body", "")
        twilio_sid = body_params.get("MessageSid", "")

        if not from_number or not message_body:
            return PlainTextResponse(
                '<?xml version="1.0" encoding="UTF-8"?><Response/>',
                media_type="text/xml",
            )

        # Find or create conversation
        conv = await asyncio.to_thread(
            db.find_or_create_sms_conversation,
            phone_number=from_number,
        )

        was_new = conv.get("created", False)

        if was_new:
            broadcast({
                "entity": "sms_conversation",
                "action": "created",
                "id": conv["id"],
            })

        # Save message
        msg = await asyncio.to_thread(
            db.create_sms_message,
            conversation_id=conv["id"],
            direction="inbound",
            body=message_body,
            twilio_sid=twilio_sid,
            status="received",
        )

        if msg:
            broadcast({
                "entity": "sms_message",
                "action": "received",
                "id": msg["id"],
                "conversation_id": conv["id"],
            })

        # Return empty TwiML so Twilio doesn't auto-reply
        return PlainTextResponse(
            '<?xml version="1.0" encoding="UTF-8"?><Response/>',
            media_type="text/xml",
        )

    @mcp.custom_route("/api/v1/sms/conversations/{conversation_id}", methods=["PATCH"])
    async def api_update_conversation(request):
        """Update conversation label."""
        if err := auth.require_auth(request):
            return err

        conversation_id = int(request.path_params["conversation_id"])

        try:
            body = await request.json()
        except Exception:
            return api_error("Invalid JSON body", "BAD_REQUEST", 400)

        label = body.get("label")
        if label is None:
            return api_error("label is required", "VALIDATION_ERROR", 400)

        result = await asyncio.to_thread(
            db.update_sms_conversation_label,
            conversation_id=conversation_id,
            label=label,
        )
        if not result:
            return api_error("Conversation not found", "NOT_FOUND", 404)

        return JSONResponse(result)
