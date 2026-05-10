"""Server-side auth session store for token revocation."""

import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select

from db.session import SessionLocal
from models import AuthSession


def create_auth_session(user_id: int, ttl_hours: int) -> str:
    sid = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=ttl_hours)
    with SessionLocal() as session:
        session.add(AuthSession(
            sid=sid,
            user_id=user_id if user_id > 0 else None,
            expires_at=expires_at,
        ))
        session.commit()
    return sid


def validate_auth_session(sid: str) -> bool:
    with SessionLocal() as session:
        row = session.execute(
            select(AuthSession.sid).where(
                AuthSession.sid == sid,
                AuthSession.expires_at > datetime.now(timezone.utc),
            )
        ).first()
        return row is not None


def extend_auth_session(sid: str, ttl_hours: int) -> None:
    new_expiry = datetime.now(timezone.utc) + timedelta(hours=ttl_hours)
    with SessionLocal() as session:
        row = session.get(AuthSession, sid)
        if row:
            row.expires_at = new_expiry
            session.commit()


def delete_auth_session(sid: str) -> None:
    with SessionLocal() as session:
        session.execute(delete(AuthSession).where(AuthSession.sid == sid))
        session.commit()


def delete_user_sessions(user_id: int) -> None:
    with SessionLocal() as session:
        session.execute(delete(AuthSession).where(AuthSession.user_id == user_id))
        session.commit()


def cleanup_expired_sessions() -> int:
    with SessionLocal() as session:
        result = session.execute(
            delete(AuthSession).where(AuthSession.expires_at <= datetime.now(timezone.utc))
        )
        session.commit()
        return result.rowcount
