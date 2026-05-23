"""
SMS messaging API routes.

Endpoints for listing conversations, viewing messages, sending SMS via Twilio,
and receiving inbound messages via Twilio webhook.
"""

import asyncio
import logging
import os
import uuid
from pathlib import Path

import httpx
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, Response
from pydantic import ValidationError

import auth
import db
from config import settings
from .common import api_error
from .sse import broadcast

logger = logging.getLogger(__name__)


def _get_twilio_client():
    """Lazy-load Twilio client only when needed."""
    if not settings.twilio_account_sid or not settings.twilio_token:
        return None
    from twilio.rest import Client
    return Client(settings.twilio_account_sid, settings.twilio_token)


def _validate_twilio_signature(request, body_params: dict) -> bool:
    """Validate that the request came from Twilio.

    Uses X-Forwarded-* headers to reconstruct the public URL, since behind
    a reverse proxy request.url shows the internal address.
    """
    if not settings.twilio_token:
        logger.warning("No Twilio auth token configured, skipping signature validation")
        return False
    from twilio.request_validator import RequestValidator
    validator = RequestValidator(settings.twilio_token)

    # Reconstruct the public-facing URL that Twilio actually called
    proto = request.headers.get("X-Forwarded-Proto", request.url.scheme)
    host = request.headers.get("X-Forwarded-Host", request.headers.get("Host", request.url.hostname))
    url = f"{proto}://{host}{request.url.path}"
    signature = request.headers.get("X-Twilio-Signature", "")

    logger.debug("Twilio signature validation — url=%s", url)
    return validator.validate(url, body_params, signature)


_CONTENT_TYPE_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "video/mp4": ".mp4",
    "video/3gpp": ".3gp",
    "audio/mpeg": ".mp3",
    "audio/ogg": ".ogg",
    "audio/amr": ".amr",
    "application/pdf": ".pdf",
    "text/vcard": ".vcf",
}


def _ext_from_content_type(content_type: str) -> str:
    """Map content type to file extension."""
    return _CONTENT_TYPE_EXTENSIONS.get(content_type.split(";")[0].strip(), ".bin")


def register_sms_routes(mcp):
    """Register SMS messaging routes."""

    @mcp.custom_route("/api/v1/sms/firm-number", methods=["GET"])
    async def api_firm_number(request):
        """Return the firm's Twilio phone number for display."""
        if err := auth.require_auth(request):
            return err
        phone = settings.twilio_phone
        return JSONResponse({"phone_number": phone} if phone else {"phone_number": None})

    @mcp.custom_route("/api/v1/sms/conversations", methods=["GET"])
    async def api_list_conversations(request):
        """List SMS conversations sorted by most recent."""
        if err := auth.require_auth(request):
            return err

        limit = int(request.query_params.get("limit", "50"))
        offset = int(request.query_params.get("offset", "0"))
        archived = request.query_params.get("archived", "false").lower() == "true"
        search = request.query_params.get("search", "").strip() or None

        result = await asyncio.to_thread(
            db.list_sms_conversations,
            limit=limit,
            offset=offset,
            archived=archived,
            search=search,
        )
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/sms/conversations/{conversation_id}", methods=["GET"])
    async def api_get_conversation(request):
        """Get a single conversation by ID."""
        if err := auth.require_auth(request):
            return err

        conversation_id = int(request.path_params["conversation_id"])
        conv = await asyncio.to_thread(db.get_sms_conversation, conversation_id)
        if not conv:
            return api_error("Conversation not found", "NOT_FOUND", 404)
        return JSONResponse(conv)

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
        case_id = body.get("case_id")
        person_id = body.get("person_id")

        result = await asyncio.to_thread(
            db.find_or_create_sms_conversation,
            phone_number=phone_number,
            label=label,
            case_id=case_id,
            person_id=person_id,
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
        if client and settings.twilio_phone:
            try:
                create_kwargs = dict(
                    body=message_body,
                    from_=settings.twilio_phone,
                    to=conv["phone_number"],
                )
                if settings.mcp_base_url:
                    create_kwargs["status_callback"] = (
                        f"{settings.mcp_base_url.rstrip('/')}/api/v1/sms/status-callback"
                    )
                twilio_msg = client.messages.create(**create_kwargs)
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
        if settings.twilio_token:
            if not _validate_twilio_signature(request, body_params):
                logger.warning("Invalid Twilio signature on SMS webhook")
                return PlainTextResponse("Forbidden", status_code=403)

        from_number = body_params.get("From", "")
        message_body = body_params.get("Body", "")
        twilio_sid = body_params.get("MessageSid", "")
        num_media = int(body_params.get("NumMedia", "0"))

        if not from_number:
            return PlainTextResponse(
                '<?xml version="1.0" encoding="UTF-8"?><Response/>',
                media_type="text/xml",
            )

        # Find or create conversation (auto-unarchives on inbound via create_message)
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

        # Save message (body may be empty for media-only MMS)
        msg = await asyncio.to_thread(
            db.create_sms_message,
            conversation_id=conv["id"],
            direction="inbound",
            body=message_body or "",
            twilio_sid=twilio_sid,
            status="received",
        )

        # Download and save media attachments to disk
        if msg and num_media > 0:
            twilio_auth = None
            if settings.twilio_account_sid and settings.twilio_token:
                twilio_auth = (settings.twilio_account_sid, settings.twilio_token)

            media_dir = Path(settings.media_dir) / "sms"
            media_dir.mkdir(parents=True, exist_ok=True)

            async with httpx.AsyncClient() as http_client:
                for i in range(num_media):
                    media_url = body_params.get(f"MediaUrl{i}")
                    media_type = body_params.get(f"MediaContentType{i}", "application/octet-stream")
                    if not media_url:
                        continue

                    try:
                        resp = await http_client.get(
                            media_url,
                            auth=twilio_auth,
                            follow_redirects=True,
                            timeout=30.0,
                        )
                        resp.raise_for_status()

                        # Determine file extension from content type
                        ext = _ext_from_content_type(media_type)
                        filename = f"{uuid.uuid4().hex}{ext}"
                        file_path = media_dir / filename
                        file_path.write_bytes(resp.content)

                        await asyncio.to_thread(
                            db.create_sms_message_media,
                            message_id=msg["id"],
                            content_type=media_type,
                            original_url=media_url,
                            filename=filename,
                            file_size=len(resp.content),
                            local_path=str(file_path),
                        )
                    except Exception as e:
                        logger.error("Failed to download media %s: %s", media_url, e)
                        # Still record the media entry without local file
                        await asyncio.to_thread(
                            db.create_sms_message_media,
                            message_id=msg["id"],
                            content_type=media_type,
                            original_url=media_url,
                        )

        if msg:
            broadcast({
                "entity": "sms_message",
                "action": "received",
                "id": msg["id"],
                "conversation_id": conv["id"],
            })

            # Send SMS notification to NOTIFY_PHONE
            if settings.notify_phone and from_number != settings.notify_phone:
                try:
                    notify_client = _get_twilio_client()
                    if notify_client and settings.twilio_phone:
                        preview = (message_body[:80] + "…") if len(message_body) > 80 else message_body
                        notify_body = f"New SMS from {from_number}"
                        if preview:
                            notify_body += f": \"{preview}\""
                        notify_body += "\nhttps://your-production-host/sms"
                        notify_client.messages.create(
                            body=notify_body,
                            from_=settings.twilio_phone,
                            to=settings.notify_phone,
                        )
                except Exception as e:
                    logger.error("Failed to send SMS notification: %s", e)

        # Return empty TwiML so Twilio doesn't auto-reply
        return PlainTextResponse(
            '<?xml version="1.0" encoding="UTF-8"?><Response/>',
            media_type="text/xml",
        )

    @mcp.custom_route("/api/v1/sms/status-callback", methods=["POST"])
    async def api_twilio_status_callback(request):
        """Receive message status updates from Twilio.

        No auth — validated via Twilio request signature.
        Twilio sends: MessageSid, MessageStatus, To, From, etc.
        """
        form = await request.form()
        body_params = dict(form)

        if settings.twilio_token:
            if not _validate_twilio_signature(request, body_params):
                logger.warning("Invalid Twilio signature on status callback")
                return PlainTextResponse("Forbidden", status_code=403)

        twilio_sid = body_params.get("MessageSid", "")
        message_status = body_params.get("MessageStatus", "")

        if twilio_sid and message_status:
            await asyncio.to_thread(
                db.update_sms_message_status, twilio_sid, message_status,
            )
            logger.info("SMS status update: %s -> %s", twilio_sid, message_status)

        return PlainTextResponse("OK", status_code=200)

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

    @mcp.custom_route("/api/v1/sms/conversations/{conversation_id}/archive", methods=["POST"])
    async def api_archive_conversation(request):
        """Archive or unarchive a conversation."""
        if err := auth.require_auth(request):
            return err

        conversation_id = int(request.path_params["conversation_id"])

        try:
            body = await request.json()
        except Exception:
            return api_error("Invalid JSON body", "BAD_REQUEST", 400)

        archived = body.get("archived", True)

        result = await asyncio.to_thread(
            db.archive_sms_conversation,
            conversation_id=conversation_id,
            archived=archived,
        )
        if not result:
            return api_error("Conversation not found", "NOT_FOUND", 404)

        broadcast({
            "entity": "sms_conversation",
            "action": "archived" if archived else "unarchived",
            "id": conversation_id,
        })

        return JSONResponse(result)

    @mcp.custom_route("/api/v1/sms/conversations/{conversation_id}", methods=["DELETE"])
    async def api_delete_conversation(request):
        """Delete an archived conversation and all its messages."""
        if err := auth.require_auth(request):
            return err

        conversation_id = int(request.path_params["conversation_id"])

        # Only allow deleting archived conversations
        conv = await asyncio.to_thread(db.get_sms_conversation, conversation_id)
        if not conv:
            return api_error("Conversation not found", "NOT_FOUND", 404)
        if not conv.get("archived"):
            return api_error("Only archived conversations can be deleted", "VALIDATION_ERROR", 400)

        deleted = await asyncio.to_thread(
            db.delete_sms_conversation,
            conversation_id=conversation_id,
        )
        if not deleted:
            return api_error("Conversation not found", "NOT_FOUND", 404)

        broadcast({
            "entity": "sms_conversation",
            "action": "deleted",
            "id": conversation_id,
        })

        return JSONResponse({"ok": True})

    @mcp.custom_route("/api/v1/sms/unread-counts", methods=["GET"])
    async def api_unread_counts(request):
        """Get unread inbound message counts for conversations."""
        if err := auth.require_auth(request):
            return err

        user = auth.get_current_user(request)
        if not user:
            return api_error("Unauthorized", "UNAUTHORIZED", 401)

        ids = request.query_params.getlist("ids")
        if not ids:
            return JSONResponse({})

        conversation_ids = [int(i) for i in ids]
        counts = await asyncio.to_thread(
            db.get_sms_unread_counts,
            user_id=user["id"],
            conversation_ids=conversation_ids,
        )
        # Return string keys to match intakes pattern
        return JSONResponse({str(k): v for k, v in counts.items()})

    @mcp.custom_route("/api/v1/sms/conversations/{conversation_id}/read", methods=["POST"])
    async def api_mark_conversation_read(request):
        """Mark a conversation as read for the current user."""
        if err := auth.require_auth(request):
            return err

        user = auth.get_current_user(request)
        if not user:
            return api_error("Unauthorized", "UNAUTHORIZED", 401)

        conversation_id = int(request.path_params["conversation_id"])
        await asyncio.to_thread(
            db.mark_sms_conversation_read,
            conversation_id=conversation_id,
            user_id=user["id"],
        )
        return JSONResponse({"success": True})

    @mcp.custom_route("/api/v1/sms/media/{media_id}/token", methods=["POST"])
    async def api_create_media_file_token(request):
        if err := auth.require_auth(request):
            return err
        media_id = int(request.path_params["media_id"])
        token = auth.create_file_token(f"/sms/media/{media_id}")
        return JSONResponse({"token": token})

    @mcp.custom_route("/api/v1/sms/media/{media_id}", methods=["GET"])
    async def api_serve_media(request):
        """Serve a media file from local storage."""
        token_param = request.query_params.get("token")
        media_id = int(request.path_params["media_id"])
        if token_param and not request.headers.get("Authorization"):
            if not auth.validate_file_token(token_param, f"/sms/media/{media_id}"):
                return api_error("Invalid or expired download link", "UNAUTHORIZED", 401)
        elif err := auth.require_auth(request):
            return err

        media = await asyncio.to_thread(db.get_sms_media_by_id, media_id)
        if not media:
            return api_error("Media not found", "NOT_FOUND", 404)

        local_path = media.get("local_path")
        if not local_path or not os.path.isfile(local_path):
            return api_error("Media file not found on disk", "NOT_FOUND", 404)

        return FileResponse(
            local_path,
            media_type=media["content_type"],
            filename=media.get("filename"),
            headers={"Cache-Control": "private, max-age=86400"},
        )

    @mcp.custom_route("/api/v1/sms/conversations/{conversation_id}/link", methods=["POST"])
    async def api_link_conversation(request):
        """Link an SMS conversation to a case and/or person."""
        if err := auth.require_auth(request):
            return err
        conversation_id = int(request.path_params["conversation_id"])
        data = await request.json()
        _UNSET = object()
        case_id = data.get("case_id", _UNSET)
        person_id = data.get("person_id", _UNSET)
        kwargs = {}
        if case_id is not _UNSET:
            kwargs["case_id"] = case_id
        if person_id is not _UNSET:
            kwargs["person_id"] = person_id
        result = await asyncio.to_thread(
            db.link_conversation, conversation_id, **kwargs,
        )
        if not result:
            return api_error("Conversation not found", "NOT_FOUND", 404)
        return JSONResponse(result)

    @mcp.custom_route("/api/v1/sms/by-person/{person_id}", methods=["GET"])
    async def api_get_conversations_by_person(request):
        """Get SMS conversations linked to a person."""
        if err := auth.require_auth(request):
            return err
        person_id = int(request.path_params["person_id"])
        results = await asyncio.to_thread(db.get_conversations_by_person, person_id)
        return JSONResponse({"conversations": results})
