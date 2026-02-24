"""
Case comment operations — threaded comments per case.

Mirrors db/intake_comments.py pattern.
"""

import datetime
from typing import Optional

from sqlalchemy import select, func, and_
from sqlalchemy.orm import joinedload

from .session import SessionLocal
from models import CaseComment, CaseCommentRead, User


def _comment_to_dict(comment: CaseComment) -> dict:
    """Flatten a CaseComment ORM instance into a serializable dict."""
    user = comment.user
    return {
        "id": comment.id,
        "case_id": comment.case_id,
        "content": comment.content,
        "is_system": comment.is_system or False,
        "detail": comment.detail,
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
        "user_id": comment.user_id,
        "user_first_name": user.first_name if user else None,
        "user_last_name": user.last_name if user else None,
        "user_initials": user.initials if user else None,
    }


def get_case_comments(case_id: int) -> list[dict]:
    """Get all comments for a case, chronological, with user info."""
    with SessionLocal() as session:
        comments = (
            session.scalars(
                select(CaseComment)
                .options(joinedload(CaseComment.user))
                .where(CaseComment.case_id == case_id)
                .order_by(CaseComment.created_at.asc())
            )
            .unique()
            .all()
        )
        return [_comment_to_dict(c) for c in comments]


def add_case_comment(
    case_id: int,
    user_id: Optional[int],
    content: str,
    is_system: bool = False,
    detail: Optional[dict] = None,
) -> dict:
    """Insert a new comment. Returns the created comment dict."""
    with SessionLocal() as session:
        comment = CaseComment(
            case_id=case_id,
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


def get_last_read_at(case_id: int, user_id: int) -> Optional[str]:
    """Get the last_read_at ISO string for this user on this case."""
    with SessionLocal() as session:
        record = session.get(CaseCommentRead, (case_id, user_id))
        if record and record.last_read_at:
            return record.last_read_at.isoformat()
        return None


def mark_case_read(case_id: int, user_id: int) -> None:
    """Mark all comments as read for this user on this case (upsert)."""
    with SessionLocal() as session:
        existing = session.get(CaseCommentRead, (case_id, user_id))
        if existing:
            existing.last_read_at = func.now()
        else:
            session.add(CaseCommentRead(
                case_id=case_id,
                user_id=user_id,
                last_read_at=func.now(),
            ))
        session.commit()


def get_unread_counts(user_id: int, case_ids: list[int]) -> dict[int, int]:
    """Get unread comment counts per case for the given user.

    A comment is "unread" if it was created after the user's last_read_at
    (or if the user has never read that case's comments).
    Excludes the user's own comments from the count.
    """
    if not case_ids:
        return {}

    with SessionLocal() as session:
        read_sub = (
            select(
                CaseCommentRead.case_id,
                CaseCommentRead.last_read_at,
            )
            .where(CaseCommentRead.user_id == user_id)
            .subquery()
        )

        stmt = (
            select(
                CaseComment.case_id,
                func.count(CaseComment.id),
            )
            .outerjoin(read_sub, CaseComment.case_id == read_sub.c.case_id)
            .where(
                and_(
                    CaseComment.case_id.in_(case_ids),
                    CaseComment.user_id != user_id,
                    (
                        (read_sub.c.last_read_at.is_(None))
                        | (CaseComment.created_at > read_sub.c.last_read_at)
                    ),
                )
            )
            .group_by(CaseComment.case_id)
        )

        rows = session.execute(stmt).all()
        return {case_id: count for case_id, count in rows}
