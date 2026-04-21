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
        pv = PageView(user_id=user_id, path=path)
        session.add(pv)
        session.commit()


def get_activity_summary() -> dict:
    """Get activity summary for all users: last active times and page view stats."""
    with SessionLocal() as session:
        # Get all active users with their last_active_at
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

        # Top pages across all users (last 30 days)
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)

        top_pages = session.execute(
            select(PageView.path, func.count().label("view_count"))
            .where(PageView.viewed_at >= thirty_days_ago)
            .group_by(PageView.path)
            .order_by(desc("view_count"))
            .limit(50)
        ).all()

        return {
            "users": user_list,
            "top_pages": [{"path": p.path, "view_count": p.view_count} for p in top_pages],
        }


def get_user_page_views(user_id: int, limit: int = 50) -> list[dict]:
    """Get recent page views for a specific user."""
    with SessionLocal() as session:
        views = session.execute(
            select(PageView.path, func.count().label("view_count"),
                   func.max(PageView.viewed_at).label("last_viewed"))
            .where(PageView.user_id == user_id)
            .group_by(PageView.path)
            .order_by(desc("view_count"))
            .limit(limit)
        ).all()

        return [
            {
                "path": v.path,
                "view_count": v.view_count,
                "last_viewed": v.last_viewed.isoformat() if v.last_viewed else None,
            }
            for v in views
        ]
