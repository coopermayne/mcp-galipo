"""
User activity tracking — last_active_at updates and page view recording.
"""

import time
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func, desc

from .session import SessionLocal
from models import User, PageView


# In-memory throttle: only write last_active_at once per minute per user
_last_touch: dict[int, float] = {}
_TOUCH_INTERVAL = 60  # seconds


def touch_last_active(user_id: int) -> None:
    """Update user's last_active_at, throttled to once per minute."""
    now = time.monotonic()
    last = _last_touch.get(user_id, 0)
    if now - last < _TOUCH_INTERVAL:
        return

    _last_touch[user_id] = now
    with SessionLocal() as session:
        user = session.get(User, user_id)
        if user:
            user.last_active_at = datetime.now(timezone.utc)
            session.commit()


def record_page_view(user_id: int, path: str) -> None:
    """Record a page view for the given user."""
    with SessionLocal() as session:
        pv = PageView(user_id=user_id, path=path, viewed_at=datetime.now(timezone.utc))
        session.add(pv)
        session.commit()


def get_activity_summary() -> dict:
    """Get activity summary: user list with last active times."""
    with SessionLocal() as session:
        users = session.execute(
            select(User.id, User.first_name, User.last_name, User.email,
                   User.initials, User.last_active_at)
            .where(User.is_active == True)
            .order_by(User.last_active_at.desc().nulls_last())
        ).all()

        user_list = []
        for u in users:
            user_list.append({
                "id": u.id,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "email": u.email,
                "initials": u.initials,
                "last_active_at": u.last_active_at.isoformat() if u.last_active_at else None,
            })

        return {"users": user_list}


def get_page_views_paginated(page: int = 1, page_size: int = 25) -> dict:
    """Get all page views, most recent first, with pagination."""
    offset = (page - 1) * page_size
    with SessionLocal() as session:
        total = session.scalar(select(func.count()).select_from(PageView))

        rows = session.execute(
            select(PageView.id, PageView.path, PageView.viewed_at,
                   PageView.user_id, User.first_name, User.last_name,
                   User.initials)
            .join(User, PageView.user_id == User.id)
            .order_by(desc(PageView.viewed_at))
            .offset(offset)
            .limit(page_size)
        ).all()

        items = []
        for r in rows:
            items.append({
                "id": r.id,
                "path": r.path,
                "viewed_at": r.viewed_at.isoformat() if r.viewed_at else None,
                "user_id": r.user_id,
                "user_name": f"{r.first_name} {r.last_name}",
                "user_initials": r.initials,
            })

        return {
            "items": items,
            "total": total or 0,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, -(-total // page_size)) if total else 1,
        }


def get_user_page_views(user_id: int, page: int = 1, page_size: int = 25) -> dict:
    """Get page views for a specific user, most recent first, with pagination."""
    offset = (page - 1) * page_size
    with SessionLocal() as session:
        total = session.scalar(
            select(func.count()).select_from(PageView)
            .where(PageView.user_id == user_id)
        )

        rows = session.execute(
            select(PageView.id, PageView.path, PageView.viewed_at)
            .where(PageView.user_id == user_id)
            .order_by(desc(PageView.viewed_at))
            .offset(offset)
            .limit(page_size)
        ).all()

        items = [
            {
                "id": r.id,
                "path": r.path,
                "viewed_at": r.viewed_at.isoformat() if r.viewed_at else None,
            }
            for r in rows
        ]

        return {
            "items": items,
            "total": total or 0,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, -(-total // page_size)) if total else 1,
        }
