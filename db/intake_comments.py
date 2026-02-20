"""
Intake comment operations — threaded comments per intake lead.
"""

import datetime
from typing import Optional

from sqlalchemy import select, func, and_
from sqlalchemy.orm import joinedload

from .session import SessionLocal
from models import IntakeComment, IntakeCommentRead, User


def _comment_to_dict(comment: IntakeComment) -> dict:
    """Flatten an IntakeComment ORM instance into a serializable dict."""
    user = comment.user
    return {
        "id": comment.id,
        "intake_id": comment.intake_id,
        "content": comment.content,
        "is_system": comment.is_system or False,
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
        "user_id": comment.user_id,
        "user_first_name": user.first_name if user else None,
        "user_last_name": user.last_name if user else None,
        "user_initials": user.initials if user else None,
    }


def get_intake_comments(intake_id: int) -> list[dict]:
    """Get all comments for an intake, chronological, with user info."""
    with SessionLocal() as session:
        comments = (
            session.scalars(
                select(IntakeComment)
                .options(joinedload(IntakeComment.user))
                .where(IntakeComment.intake_id == intake_id)
                .order_by(IntakeComment.created_at.asc())
            )
            .unique()
            .all()
        )
        return [_comment_to_dict(c) for c in comments]


def add_intake_comment(
    intake_id: int,
    user_id: Optional[int],
    content: str,
    is_system: bool = False,
) -> dict:
    """Insert a new comment. Returns the created comment dict."""
    with SessionLocal() as session:
        comment = IntakeComment(
            intake_id=intake_id,
            user_id=user_id,
            content=content,
            is_system=is_system,
        )
        session.add(comment)
        session.flush()
        session.refresh(comment)
        # Eagerly load user
        if comment.user_id:
            comment.user  # noqa: B018 — triggers lazy load inside session
        result = _comment_to_dict(comment)
        session.commit()
        return result


def delete_intake_comment(comment_id: int, user_id: int) -> bool:
    """Delete a comment. Only the author can delete, and system messages cannot be deleted."""
    with SessionLocal() as session:
        comment = session.get(IntakeComment, comment_id)
        if not comment:
            return False
        if comment.is_system:
            return False
        if comment.user_id != user_id:
            return False
        session.delete(comment)
        session.commit()
        return True


def mark_intake_read(intake_id: int, user_id: int) -> None:
    """Mark all comments as read for this user on this intake (upsert)."""
    with SessionLocal() as session:
        existing = session.get(IntakeCommentRead, (intake_id, user_id))
        if existing:
            existing.last_read_at = func.now()
        else:
            session.add(IntakeCommentRead(
                intake_id=intake_id,
                user_id=user_id,
                last_read_at=func.now(),
            ))
        session.commit()


def get_unread_counts(user_id: int, intake_ids: list[int]) -> dict[int, int]:
    """Get unread comment counts per intake for the given user.

    A comment is "unread" if it was created after the user's last_read_at
    (or if the user has never read that intake's comments).
    Excludes the user's own comments from the count.
    """
    if not intake_ids:
        return {}

    with SessionLocal() as session:
        # Subquery: get last_read_at per intake for this user
        read_sub = (
            select(
                IntakeCommentRead.intake_id,
                IntakeCommentRead.last_read_at,
            )
            .where(IntakeCommentRead.user_id == user_id)
            .subquery()
        )

        # Count comments that are newer than last_read_at (or all if never read)
        # Exclude the user's own comments
        stmt = (
            select(
                IntakeComment.intake_id,
                func.count(IntakeComment.id),
            )
            .outerjoin(read_sub, IntakeComment.intake_id == read_sub.c.intake_id)
            .where(
                and_(
                    IntakeComment.intake_id.in_(intake_ids),
                    IntakeComment.user_id != user_id,
                    # Unread: created after last_read_at, or never read (null)
                    (
                        (read_sub.c.last_read_at.is_(None))
                        | (IntakeComment.created_at > read_sub.c.last_read_at)
                    ),
                )
            )
            .group_by(IntakeComment.intake_id)
        )

        rows = session.execute(stmt).all()
        return {intake_id: count for intake_id, count in rows}
