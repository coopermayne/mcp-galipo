"""
Intake comment operations — threaded comments per intake lead.
"""

import datetime
from typing import Optional

from sqlalchemy import select, func, and_, or_
from sqlalchemy.dialects.postgresql import insert
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
        "detail": comment.detail,
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
    detail: Optional[dict] = None,
) -> dict:
    """Insert a new comment. Returns the created comment dict."""
    with SessionLocal() as session:
        comment = IntakeComment(
            intake_id=intake_id,
            user_id=user_id,
            content=content,
            is_system=is_system,
            detail=detail,
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


def get_last_read_at(intake_id: int, user_id: int) -> Optional[str]:
    """Get the last_read_at ISO string for this user on this intake."""
    with SessionLocal() as session:
        record = session.get(IntakeCommentRead, (intake_id, user_id))
        if record and record.last_read_at:
            return record.last_read_at.isoformat()
        return None


def mark_intake_read(intake_id: int, user_id: int) -> None:
    """Mark all comments as read for this user on this intake (upsert)."""
    if user_id == 0:
        return
    with SessionLocal() as session:
        stmt = insert(IntakeCommentRead).values(
            intake_id=intake_id,
            user_id=user_id,
            last_read_at=func.now(),
        ).on_conflict_do_update(
            index_elements=["intake_id", "user_id"],
            set_={"last_read_at": func.now()},
        )
        session.execute(stmt)
        session.commit()


def get_recent_activity(limit: int = 50) -> list[dict]:
    """Get recent system comments across all intakes (activity feed)."""
    with SessionLocal() as session:
        comments = (
            session.scalars(
                select(IntakeComment)
                .options(
                    joinedload(IntakeComment.user),
                    joinedload(IntakeComment.intake),
                )
                .where(IntakeComment.is_system == True)  # noqa: E712
                .order_by(IntakeComment.created_at.desc())
                .limit(limit)
            )
            .unique()
            .all()
        )
        return [
            {
                "id": c.id,
                "intake_id": c.intake_id,
                "intake_name": c.intake.name if c.intake else None,
                "content": c.content,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "user_id": c.user_id,
                "user_first_name": c.user.first_name if c.user else None,
                "user_initials": c.user.initials if c.user else None,
            }
            for c in comments
        ]


def get_comment_flags(intake_ids: list[int]) -> dict[int, bool]:
    """For each intake, return True if there's a user comment since the last status change.

    Logic:
    - No user comments at all → False
    - User comment exists but no status change ever happened → True
    - User comment exists after the last status change → True
    - Otherwise → False
    """
    if not intake_ids:
        return {}

    with SessionLocal() as session:
        # Last status-change system comment per intake
        # Only match "X changed status from Y to Z" entries, not all system comments
        last_changes = dict(
            session.execute(
                select(IntakeComment.intake_id, func.max(IntakeComment.created_at))
                .where(
                    IntakeComment.intake_id.in_(intake_ids),
                    IntakeComment.is_system == True,  # noqa: E712
                    IntakeComment.content.like("%changed status from%"),
                )
                .group_by(IntakeComment.intake_id)
            ).all()
        )

        # Last user (non-system) comment per intake
        last_user_comments = dict(
            session.execute(
                select(IntakeComment.intake_id, func.max(IntakeComment.created_at))
                .where(
                    IntakeComment.intake_id.in_(intake_ids),
                    or_(
                        IntakeComment.is_system == False,  # noqa: E712
                        IntakeComment.is_system.is_(None),
                    ),
                )
                .group_by(IntakeComment.intake_id)
            ).all()
        )

    result = {}
    for iid in intake_ids:
        last_comment = last_user_comments.get(iid)
        if last_comment is None:
            result[iid] = False
        else:
            last_change = last_changes.get(iid)
            result[iid] = last_change is None or last_comment > last_change
    return result


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
