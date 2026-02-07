"""
User management database operations — SQLAlchemy ORM implementation.

Provides CRUD functions for users with bcrypt password hashing.
"""

import bcrypt
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.orm import joinedload

from .session import SessionLocal
from models import User


# Sentinel value to distinguish "not provided" from None
_NOT_PROVIDED = object()

# Bcrypt cost factor (12 is a good balance of security and performance)
BCRYPT_COST = 12


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(BCRYPT_COST)).decode('utf-8')


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against a bcrypt hash."""
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))


def _build_paralegal_dict(user: User) -> Optional[dict]:
    """Build the nested paralegal dict from the ORM relationship."""
    if user.paralegal_id and user.paralegal:
        return {
            'id': user.paralegal.id,
            'first_name': user.paralegal.first_name,
            'last_name': user.paralegal.last_name,
            'initials': user.paralegal.initials,
        }
    return None


def _user_to_dict(user: User, include_password_hash: bool = False) -> dict:
    """Convert a User ORM object to a plain dict."""
    result = {
        'id': user.id,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'initials': user.initials,
        'bar_number': user.bar_number,
        'position': user.position,
        'is_admin': user.is_admin,
        'must_change_password': user.must_change_password,
        'is_active': user.is_active,
        'paralegal_id': user.paralegal_id,
        'created_at': user.created_at.isoformat() if user.created_at else None,
        'updated_at': user.updated_at.isoformat() if user.updated_at else None,
        'paralegal': _build_paralegal_dict(user),
    }
    if include_password_hash:
        result['password_hash'] = user.password_hash
    return result


def get_user_by_id(user_id: int) -> Optional[dict]:
    """Get a user by their ID, including paralegal info if set."""
    with SessionLocal() as session:
        user = session.scalars(
            select(User)
            .options(joinedload(User.paralegal))
            .where(User.id == user_id)
        ).unique().first()
        if not user:
            return None
        return _user_to_dict(user)


def get_user_by_email(email: str) -> Optional[dict]:
    """Get a user by their email address (includes password_hash for auth)."""
    with SessionLocal() as session:
        user = session.scalars(
            select(User).where(User.email == email.lower())
        ).first()
        if not user:
            return None
        return _user_to_dict(user, include_password_hash=True)


def get_all_users(include_inactive: bool = False) -> list[dict]:
    """Get all users, optionally including inactive ones."""
    with SessionLocal() as session:
        stmt = (
            select(User)
            .options(joinedload(User.paralegal))
            .order_by(User.last_name, User.first_name)
        )
        if not include_inactive:
            stmt = stmt.where(User.is_active == True)

        users = session.scalars(stmt).unique().all()
        return [_user_to_dict(u) for u in users]


def create_user(
    email: str,
    password: str,
    first_name: str,
    last_name: str,
    initials: str,
    position: str,
    bar_number: Optional[str] = None,
    is_admin: bool = False,
    must_change_password: bool = True
) -> dict:
    """Create a new user with hashed password."""
    password_hash_val = hash_password(password)

    with SessionLocal() as session:
        user = User(
            email=email.lower(),
            password_hash=password_hash_val,
            first_name=first_name,
            last_name=last_name,
            initials=initials,
            position=position,
            bar_number=bar_number,
            is_admin=is_admin,
            must_change_password=must_change_password,
        )
        session.add(user)
        session.flush()
        session.refresh(user)
        result = _user_to_dict(user)
        session.commit()
        return result


def update_user(
    user_id: int,
    email=_NOT_PROVIDED,
    first_name=_NOT_PROVIDED,
    last_name=_NOT_PROVIDED,
    initials=_NOT_PROVIDED,
    position=_NOT_PROVIDED,
    bar_number=_NOT_PROVIDED,
    is_admin=_NOT_PROVIDED,
    must_change_password=_NOT_PROVIDED,
    is_active=_NOT_PROVIDED,
    paralegal_id=_NOT_PROVIDED
) -> Optional[dict]:
    """Update a user's profile fields (not password)."""
    with SessionLocal() as session:
        user = session.scalars(
            select(User)
            .options(joinedload(User.paralegal))
            .where(User.id == user_id)
        ).unique().first()
        if not user:
            return None

        changed = False
        if email is not _NOT_PROVIDED:
            user.email = email.lower() if email else email
            changed = True
        if first_name is not _NOT_PROVIDED:
            user.first_name = first_name
            changed = True
        if last_name is not _NOT_PROVIDED:
            user.last_name = last_name
            changed = True
        if initials is not _NOT_PROVIDED:
            user.initials = initials
            changed = True
        if position is not _NOT_PROVIDED:
            user.position = position
            changed = True
        if bar_number is not _NOT_PROVIDED:
            user.bar_number = bar_number
            changed = True
        if is_admin is not _NOT_PROVIDED:
            user.is_admin = is_admin
            changed = True
        if must_change_password is not _NOT_PROVIDED:
            user.must_change_password = must_change_password
            changed = True
        if is_active is not _NOT_PROVIDED:
            user.is_active = is_active
            changed = True
        if paralegal_id is not _NOT_PROVIDED:
            user.paralegal_id = paralegal_id
            changed = True

        if changed:
            user.updated_at = func.now()
            session.flush()
            session.refresh(user)

        result = _user_to_dict(user)
        session.commit()
        return result


def update_password(user_id: int, new_password: str, clear_must_change: bool = True) -> bool:
    """Update a user's password."""
    password_hash_val = hash_password(new_password)

    with SessionLocal() as session:
        user = session.get(User, user_id)
        if not user:
            return False

        user.password_hash = password_hash_val
        if clear_must_change:
            user.must_change_password = False
        user.updated_at = func.now()
        session.commit()
        return True


def delete_user(user_id: int, hard_delete: bool = False) -> bool:
    """
    Delete a user. By default, performs a soft delete (is_active=False).
    Set hard_delete=True to permanently remove the user.
    """
    with SessionLocal() as session:
        user = session.get(User, user_id)
        if not user:
            return False

        if hard_delete:
            session.delete(user)
        else:
            user.is_active = False
            user.updated_at = func.now()
        session.commit()
        return True


def authenticate_user(email: str, password: str) -> Optional[dict]:
    """
    Authenticate a user by email and password.
    Returns user dict (without password_hash) if valid, None if invalid.
    """
    user = get_user_by_email(email)
    if not user:
        return None

    if not user.get('is_active', True):
        return None

    if not verify_password(password, user['password_hash']):
        return None

    del user['password_hash']
    return user


def get_attorneys() -> list[dict]:
    """Get all active attorneys with their default paralegal info."""
    with SessionLocal() as session:
        stmt = (
            select(User)
            .options(joinedload(User.paralegal))
            .where(User.position == 'attorney', User.is_active == True)
            .order_by(User.last_name, User.first_name)
        )
        users = session.scalars(stmt).unique().all()
        return [
            {
                'id': u.id,
                'first_name': u.first_name,
                'last_name': u.last_name,
                'initials': u.initials,
                'bar_number': u.bar_number,
                'paralegal_id': u.paralegal_id,
                'paralegal': _build_paralegal_dict(u),
            }
            for u in users
        ]


def get_attorneys_for_paralegal(paralegal_id: int) -> list[dict]:
    """Get all attorneys who have this paralegal assigned as their default."""
    with SessionLocal() as session:
        stmt = (
            select(User)
            .where(User.paralegal_id == paralegal_id, User.is_active == True)
            .order_by(User.last_name, User.first_name)
        )
        users = session.scalars(stmt).all()
        return [
            {
                'id': u.id,
                'email': u.email,
                'first_name': u.first_name,
                'last_name': u.last_name,
                'initials': u.initials,
                'bar_number': u.bar_number,
                'position': u.position,
                'is_admin': u.is_admin,
                'is_active': u.is_active,
                'created_at': u.created_at.isoformat() if u.created_at else None,
                'updated_at': u.updated_at.isoformat() if u.updated_at else None,
            }
            for u in users
        ]
