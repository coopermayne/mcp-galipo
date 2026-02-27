"""
SMS conversation and message database operations.
"""

import datetime
from typing import Optional

from sqlalchemy import select, func

from .session import SessionLocal
from models import SmsConversation, SmsMessage, User


def list_conversations(limit: int = 50, offset: int = 0) -> dict:
    """List SMS conversations sorted by most recent message."""
    with SessionLocal() as session:
        total = session.scalar(
            select(func.count()).select_from(SmsConversation)
        )

        stmt = (
            select(SmsConversation)
            .order_by(SmsConversation.last_message_at.desc().nullslast())
            .limit(limit)
            .offset(offset)
        )
        conversations = session.scalars(stmt).all()

        # For each conversation, get the last message preview
        results = []
        for conv in conversations:
            last_msg = session.scalar(
                select(SmsMessage)
                .where(SmsMessage.conversation_id == conv.id)
                .order_by(SmsMessage.created_at.desc())
                .limit(1)
            )
            results.append({
                "id": conv.id,
                "phone_number": conv.phone_number,
                "label": conv.label,
                "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
                "created_at": conv.created_at.isoformat() if conv.created_at else None,
                "last_message_preview": (last_msg.body[:80] + "...") if last_msg and len(last_msg.body) > 80 else (last_msg.body if last_msg else None),
                "last_message_direction": last_msg.direction if last_msg else None,
            })

        return {"conversations": results, "total": total}


def get_conversation(conversation_id: int) -> Optional[dict]:
    """Get a single conversation by ID."""
    with SessionLocal() as session:
        conv = session.get(SmsConversation, conversation_id)
        if not conv:
            return None
        return {
            "id": conv.id,
            "phone_number": conv.phone_number,
            "label": conv.label,
            "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
            "created_at": conv.created_at.isoformat() if conv.created_at else None,
        }


def get_messages(conversation_id: int, limit: int = 100, offset: int = 0) -> dict:
    """Get messages for a conversation, oldest first."""
    with SessionLocal() as session:
        conv = session.get(SmsConversation, conversation_id)
        if not conv:
            return {"messages": [], "total": 0}

        total = session.scalar(
            select(func.count()).select_from(SmsMessage)
            .where(SmsMessage.conversation_id == conversation_id)
        )

        stmt = (
            select(SmsMessage, User)
            .outerjoin(User, SmsMessage.sent_by_user_id == User.id)
            .where(SmsMessage.conversation_id == conversation_id)
            .order_by(SmsMessage.created_at.asc())
            .limit(limit)
            .offset(offset)
        )
        rows = session.execute(stmt).all()

        messages = []
        for msg, user in rows:
            messages.append({
                "id": msg.id,
                "conversation_id": msg.conversation_id,
                "direction": msg.direction,
                "body": msg.body,
                "sent_by_user_id": msg.sent_by_user_id,
                "sent_by_initials": user.initials if user else None,
                "twilio_sid": msg.twilio_sid,
                "status": msg.status,
                "created_at": msg.created_at.isoformat() if msg.created_at else None,
            })

        return {"messages": messages, "total": total}


def find_or_create_conversation(phone_number: str, label: str = None) -> dict:
    """Find existing conversation by phone number, or create a new one."""
    with SessionLocal() as session:
        conv = session.scalar(
            select(SmsConversation)
            .where(SmsConversation.phone_number == phone_number)
        )
        if conv:
            # Update label if provided and conversation has no label
            if label and not conv.label:
                conv.label = label
                session.commit()
            return {
                "id": conv.id,
                "phone_number": conv.phone_number,
                "label": conv.label,
                "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
                "created_at": conv.created_at.isoformat() if conv.created_at else None,
                "created": False,
            }

        conv = SmsConversation(
            phone_number=phone_number,
            label=label,
        )
        session.add(conv)
        session.flush()
        session.refresh(conv)
        result = {
            "id": conv.id,
            "phone_number": conv.phone_number,
            "label": conv.label,
            "last_message_at": None,
            "created_at": conv.created_at.isoformat() if conv.created_at else None,
            "created": True,
        }
        session.commit()
        return result


def create_message(
    conversation_id: int,
    direction: str,
    body: str,
    twilio_sid: str = None,
    sent_by_user_id: int = None,
    status: str = "sent",
) -> Optional[dict]:
    """Create a new SMS message and update conversation's last_message_at."""
    with SessionLocal() as session:
        conv = session.get(SmsConversation, conversation_id)
        if not conv:
            return None

        now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)

        msg = SmsMessage(
            conversation_id=conversation_id,
            direction=direction,
            body=body,
            twilio_sid=twilio_sid,
            sent_by_user_id=sent_by_user_id,
            status=status,
        )
        session.add(msg)

        # Update conversation's last_message_at
        conv.last_message_at = now

        session.flush()
        session.refresh(msg)

        # Get sender info if outbound
        sender_initials = None
        if sent_by_user_id:
            user = session.get(User, sent_by_user_id)
            if user:
                sender_initials = user.initials

        result = {
            "id": msg.id,
            "conversation_id": msg.conversation_id,
            "direction": msg.direction,
            "body": msg.body,
            "sent_by_user_id": msg.sent_by_user_id,
            "sent_by_initials": sender_initials,
            "twilio_sid": msg.twilio_sid,
            "status": msg.status,
            "created_at": msg.created_at.isoformat() if msg.created_at else None,
        }
        session.commit()
        return result


def update_conversation_label(conversation_id: int, label: str) -> Optional[dict]:
    """Update the label on a conversation."""
    with SessionLocal() as session:
        conv = session.get(SmsConversation, conversation_id)
        if not conv:
            return None
        conv.label = label
        session.flush()
        session.refresh(conv)
        result = {
            "id": conv.id,
            "phone_number": conv.phone_number,
            "label": conv.label,
            "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
            "created_at": conv.created_at.isoformat() if conv.created_at else None,
        }
        session.commit()
        return result
