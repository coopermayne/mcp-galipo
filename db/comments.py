"""
Polymorphic comment operations — works with any entity type.
"""

from typing import Optional

from sqlalchemy import select, func, and_
from sqlalchemy.orm import joinedload

from .session import SessionLocal
from models import Comment, CommentRead


def _comment_to_dict(comment: Comment) -> dict:
    user = comment.user
    return {
        "id": comment.id,
        "entity_type": comment.entity_type,
        "entity_id": comment.entity_id,
        "content": comment.content,
        "is_system": comment.is_system or False,
        "detail": comment.detail,
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
        "user_id": comment.user_id,
        "user_first_name": user.first_name if user else None,
        "user_last_name": user.last_name if user else None,
        "user_initials": user.initials if user else None,
    }


def get_comments(entity_type: str, entity_id: int) -> list[dict]:
    with SessionLocal() as session:
        comments = (
            session.scalars(
                select(Comment)
                .options(joinedload(Comment.user))
                .where(
                    Comment.entity_type == entity_type,
                    Comment.entity_id == entity_id,
                )
                .order_by(Comment.created_at.asc())
            )
            .unique()
            .all()
        )
        return [_comment_to_dict(c) for c in comments]


def add_comment(
    entity_type: str,
    entity_id: int,
    user_id: Optional[int],
    content: str,
    is_system: bool = False,
    detail: Optional[dict] = None,
) -> dict:
    with SessionLocal() as session:
        comment = Comment(
            entity_type=entity_type,
            entity_id=entity_id,
            user_id=user_id,
            content=content,
            is_system=is_system,
            detail=detail,
        )
        session.add(comment)
        session.flush()
        session.refresh(comment)
        if comment.user_id:
            comment.user  # noqa: B018
        result = _comment_to_dict(comment)
        session.commit()
        return result


def get_last_read_at(entity_type: str, entity_id: int, user_id: int) -> Optional[str]:
    with SessionLocal() as session:
        record = session.get(CommentRead, (entity_type, entity_id, user_id))
        if record and record.last_read_at:
            return record.last_read_at.isoformat()
        return None


def mark_read(entity_type: str, entity_id: int, user_id: int) -> None:
    with SessionLocal() as session:
        existing = session.get(CommentRead, (entity_type, entity_id, user_id))
        if existing:
            existing.last_read_at = func.now()
        else:
            session.add(CommentRead(
                entity_type=entity_type,
                entity_id=entity_id,
                user_id=user_id,
                last_read_at=func.now(),
            ))
        session.commit()


def get_unread_counts(
    user_id: int, entity_type: str, entity_ids: list[int]
) -> dict[int, int]:
    if not entity_ids:
        return {}

    with SessionLocal() as session:
        read_sub = (
            select(
                CommentRead.entity_id,
                CommentRead.last_read_at,
            )
            .where(
                CommentRead.entity_type == entity_type,
                CommentRead.user_id == user_id,
            )
            .subquery()
        )

        stmt = (
            select(
                Comment.entity_id,
                func.count(Comment.id),
            )
            .outerjoin(read_sub, Comment.entity_id == read_sub.c.entity_id)
            .where(
                and_(
                    Comment.entity_type == entity_type,
                    Comment.entity_id.in_(entity_ids),
                    Comment.user_id != user_id,
                    (
                        (read_sub.c.last_read_at.is_(None))
                        | (Comment.created_at > read_sub.c.last_read_at)
                    ),
                )
            )
            .group_by(Comment.entity_id)
        )

        rows = session.execute(stmt).all()
        return {entity_id: count for entity_id, count in rows}
