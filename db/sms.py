"""
SMS conversation and message database operations.
"""

import datetime
import os
from pathlib import Path
from typing import Optional

from sqlalchemy import select, func, or_, and_

from .session import SessionLocal
from models import SmsConversation, SmsConversationRead, SmsMessage, SmsMessageMedia, User, Case, Person


def _conv_dict(conv, case=None, person=None, last_msg=None) -> dict:
    d = {
        "id": conv.id,
        "phone_number": conv.phone_number,
        "label": conv.label,
        "case_id": conv.case_id,
        "person_id": conv.person_id,
        "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
        "created_at": conv.created_at.isoformat() if conv.created_at else None,
        "archived": conv.archived or False,
        "case_name": case.case_name if case else None,
        "short_name": case.short_name if case else None,
        "case_color": case.color if case else None,
        "person_name": person.name if person else None,
    }
    if last_msg is not None:
        d["last_message_preview"] = (last_msg.body[:80] + "...") if len(last_msg.body) > 80 else last_msg.body
        d["last_message_direction"] = last_msg.direction
    return d


def normalize_phone(phone: str) -> str:
    """Strip non-digits and ensure +1 prefix (E.164 US format)."""
    digits = "".join(c for c in phone if c.isdigit())
    if len(digits) == 10:
        digits = "1" + digits
    if len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"
    # Already has country code or international — return as +digits
    return f"+{digits}" if digits else phone


def list_conversations(
    limit: int = 50,
    offset: int = 0,
    archived: bool = False,
    search: Optional[str] = None,
) -> dict:
    """List SMS conversations sorted by most recent message.

    Args:
        archived: Filter by archived status (default False = active only)
        search: Optional search term — matches label, phone_number, or message body (ILIKE)
    """
    with SessionLocal() as session:
        base_filter = SmsConversation.archived == archived

        # Build search filter if provided
        if search:
            term = f"%{search}%"
            # Subquery: conversation IDs with matching message body
            msg_subq = (
                select(SmsMessage.conversation_id)
                .where(SmsMessage.body.ilike(term))
                .distinct()
                .subquery()
            )
            search_filter = or_(
                SmsConversation.label.ilike(term),
                SmsConversation.phone_number.ilike(term),
                SmsConversation.id.in_(select(msg_subq.c.conversation_id)),
            )
            combined_filter = base_filter & search_filter
        else:
            combined_filter = base_filter

        total = session.scalar(
            select(func.count())
            .select_from(SmsConversation)
            .where(combined_filter)
        )

        stmt = (
            select(SmsConversation, Case, Person)
            .outerjoin(Case, SmsConversation.case_id == Case.id)
            .outerjoin(Person, SmsConversation.person_id == Person.id)
            .where(combined_filter)
            .order_by(SmsConversation.last_message_at.desc().nullslast())
            .limit(limit)
            .offset(offset)
        )
        rows = session.execute(stmt).all()

        results = []
        for conv, case, person in rows:
            last_msg = session.scalar(
                select(SmsMessage)
                .where(SmsMessage.conversation_id == conv.id)
                .order_by(SmsMessage.created_at.desc())
                .limit(1)
            )
            d = _conv_dict(conv, case, person, last_msg)
            if last_msg is None:
                d["last_message_preview"] = None
                d["last_message_direction"] = None
            results.append(d)

        return {"conversations": results, "total": total}


def get_conversation(conversation_id: int) -> Optional[dict]:
    """Get a single conversation by ID."""
    with SessionLocal() as session:
        row = session.execute(
            select(SmsConversation, Case, Person)
            .outerjoin(Case, SmsConversation.case_id == Case.id)
            .outerjoin(Person, SmsConversation.person_id == Person.id)
            .where(SmsConversation.id == conversation_id)
        ).first()
        if not row:
            return None
        conv, case, person = row
        return _conv_dict(conv, case, person)


def get_messages(conversation_id: int, limit: int = 1000, offset: int = 0) -> dict:
    """Get messages for a conversation, oldest first. Includes media attachments."""
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
            .order_by(SmsMessage.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        rows = list(reversed(session.execute(stmt).all()))

        # Batch-load media for all messages in this page
        msg_ids = [msg.id for msg, _ in rows]
        media_map: dict[int, list[dict]] = {}
        if msg_ids:
            media_rows = session.scalars(
                select(SmsMessageMedia)
                .where(SmsMessageMedia.message_id.in_(msg_ids))
                .order_by(SmsMessageMedia.id)
            ).all()
            for m in media_rows:
                media_map.setdefault(m.message_id, []).append({
                    "id": m.id,
                    "content_type": m.content_type,
                    "filename": m.filename,
                    "file_size": m.file_size,
                })

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
                "media": media_map.get(msg.id, []),
            })

        return {"messages": messages, "total": total}


def find_or_create_conversation(phone_number: str, label: str = None,
                                case_id: int = None, person_id: int = None) -> dict:
    """Find existing conversation by phone number, or create a new one."""
    phone_number = normalize_phone(phone_number)
    with SessionLocal() as session:
        conv = session.scalar(
            select(SmsConversation)
            .where(SmsConversation.phone_number == phone_number)
        )
        if conv:
            if label and not conv.label:
                conv.label = label
            if case_id and not conv.case_id:
                conv.case_id = case_id
            if person_id and not conv.person_id:
                conv.person_id = person_id
            session.commit()
            session.refresh(conv)
            case = session.get(Case, conv.case_id) if conv.case_id else None
            person = session.get(Person, conv.person_id) if conv.person_id else None
            d = _conv_dict(conv, case, person)
            d["created"] = False
            return d

        conv = SmsConversation(
            phone_number=phone_number,
            label=label,
            case_id=case_id,
            person_id=person_id,
        )
        session.add(conv)
        session.flush()
        session.refresh(conv)
        case = session.get(Case, conv.case_id) if conv.case_id else None
        person = session.get(Person, conv.person_id) if conv.person_id else None
        d = _conv_dict(conv, case, person)
        d["created"] = True
        session.commit()
        return d


def create_message(
    conversation_id: int,
    direction: str,
    body: str,
    twilio_sid: str = None,
    sent_by_user_id: int = None,
    status: str = "sent",
) -> Optional[dict]:
    """Create a new SMS message and update conversation's last_message_at.

    Auto-unarchives the conversation if it was archived (e.g. inbound message).
    """
    with SessionLocal() as session:
        conv = session.get(SmsConversation, conversation_id)
        if not conv:
            return None

        now = datetime.datetime.now(datetime.timezone.utc)

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

        # Auto-unarchive on inbound message
        if direction == "inbound" and conv.archived:
            conv.archived = False

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
            "media": [],
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
            "archived": conv.archived or False,
        }
        session.commit()
        return result


def archive_conversation(conversation_id: int, archived: bool = True) -> Optional[dict]:
    """Archive or unarchive a conversation."""
    with SessionLocal() as session:
        conv = session.get(SmsConversation, conversation_id)
        if not conv:
            return None
        conv.archived = archived
        session.flush()
        session.refresh(conv)
        result = {
            "id": conv.id,
            "phone_number": conv.phone_number,
            "label": conv.label,
            "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
            "created_at": conv.created_at.isoformat() if conv.created_at else None,
            "archived": conv.archived or False,
        }
        session.commit()
        return result


def delete_conversation(conversation_id: int) -> bool:
    """Delete a conversation and all its messages/media (CASCADE).

    Also removes local media files from disk.
    """
    with SessionLocal() as session:
        conv = session.get(SmsConversation, conversation_id)
        if not conv:
            return False

        # Collect local media files to delete after commit
        media_paths = []
        for msg in conv.messages:
            for media in msg.media:
                if media.local_path:
                    media_paths.append(media.local_path)

        session.delete(conv)
        session.commit()

    # Clean up files after successful DB delete
    for path in media_paths:
        try:
            os.remove(path)
        except OSError:
            pass
    return True


# ---------------------------------------------------------------------------
# Media
# ---------------------------------------------------------------------------


def create_message_media(
    message_id: int,
    content_type: str,
    original_url: str,
    filename: Optional[str] = None,
    file_size: Optional[int] = None,
    local_path: Optional[str] = None,
) -> Optional[dict]:
    """Create a media attachment for a message."""
    with SessionLocal() as session:
        msg = session.get(SmsMessage, message_id)
        if not msg:
            return None

        media = SmsMessageMedia(
            message_id=message_id,
            content_type=content_type,
            original_url=original_url,
            filename=filename,
            file_size=file_size,
            local_path=local_path,
        )
        session.add(media)
        session.flush()
        session.refresh(media)
        result = {
            "id": media.id,
            "message_id": media.message_id,
            "content_type": media.content_type,
            "filename": media.filename,
            "file_size": media.file_size,
        }
        session.commit()
        return result


def get_media_by_id(media_id: int) -> Optional[dict]:
    """Get a media attachment by ID."""
    with SessionLocal() as session:
        media = session.get(SmsMessageMedia, media_id)
        if not media:
            return None
        return {
            "id": media.id,
            "message_id": media.message_id,
            "content_type": media.content_type,
            "filename": media.filename,
            "local_path": media.local_path,
            "file_size": media.file_size,
        }


# ---------------------------------------------------------------------------
# Read tracking
# ---------------------------------------------------------------------------


def mark_conversation_read(conversation_id: int, user_id: int) -> None:
    """Mark a conversation as read for this user (upsert)."""
    with SessionLocal() as session:
        existing = session.get(SmsConversationRead, (conversation_id, user_id))
        if existing:
            existing.last_read_at = func.now()
        else:
            session.add(SmsConversationRead(
                conversation_id=conversation_id,
                user_id=user_id,
                last_read_at=func.now(),
            ))
        session.commit()


def get_unread_counts(user_id: int, conversation_ids: list[int]) -> dict[int, int]:
    """Get unread inbound message counts per conversation for the given user.

    A message is "unread" if it was created after the user's last_read_at
    (or if the user has never read that conversation).
    Only counts inbound messages (outbound were sent by users).
    """
    if not conversation_ids:
        return {}

    with SessionLocal() as session:
        # Subquery: get last_read_at per conversation for this user
        read_sub = (
            select(
                SmsConversationRead.conversation_id,
                SmsConversationRead.last_read_at,
            )
            .where(SmsConversationRead.user_id == user_id)
            .subquery()
        )

        # Count inbound messages newer than last_read_at (or all if never read)
        stmt = (
            select(
                SmsMessage.conversation_id,
                func.count(SmsMessage.id),
            )
            .outerjoin(read_sub, SmsMessage.conversation_id == read_sub.c.conversation_id)
            .where(
                and_(
                    SmsMessage.conversation_id.in_(conversation_ids),
                    SmsMessage.direction == "inbound",
                    (
                        (read_sub.c.last_read_at.is_(None))
                        | (SmsMessage.created_at > read_sub.c.last_read_at)
                    ),
                )
            )
            .group_by(SmsMessage.conversation_id)
        )

        rows = session.execute(stmt).all()
        return {conversation_id: count for conversation_id, count in rows}


_UNSET = object()

def link_conversation(conversation_id: int, case_id=_UNSET, person_id=_UNSET) -> Optional[dict]:
    """Link an SMS conversation to a case and/or person. Pass None to unlink."""
    with SessionLocal() as session:
        conv = session.get(SmsConversation, conversation_id)
        if not conv:
            return None
        if case_id is not _UNSET:
            conv.case_id = case_id or None
        if person_id is not _UNSET:
            conv.person_id = person_id or None
        session.flush()
        session.refresh(conv)
        case = session.get(Case, conv.case_id) if conv.case_id else None
        person = session.get(Person, conv.person_id) if conv.person_id else None
        result = _conv_dict(conv, case, person)
        session.commit()
        return result


def get_conversations_by_person(person_id: int) -> list[dict]:
    """Get all SMS conversations linked to a person."""
    with SessionLocal() as session:
        stmt = (
            select(SmsConversation, Case, Person)
            .outerjoin(Case, SmsConversation.case_id == Case.id)
            .outerjoin(Person, SmsConversation.person_id == Person.id)
            .where(SmsConversation.person_id == person_id)
            .order_by(SmsConversation.last_message_at.desc().nullslast())
        )
        rows = session.execute(stmt).all()
        results = []
        for conv, case, person in rows:
            last_msg = session.scalar(
                select(SmsMessage)
                .where(SmsMessage.conversation_id == conv.id)
                .order_by(SmsMessage.created_at.desc())
                .limit(1)
            )
            d = _conv_dict(conv, case, person, last_msg)
            if last_msg is None:
                d["last_message_preview"] = None
                d["last_message_direction"] = None
            results.append(d)
        return results


def update_message_status(twilio_sid: str, status: str) -> bool:
    """Update an SMS message status by its Twilio SID."""
    with SessionLocal() as session:
        msg = session.scalar(
            select(SmsMessage).where(SmsMessage.twilio_sid == twilio_sid)
        )
        if not msg:
            return False
        msg.status = status
        session.commit()
        return True
