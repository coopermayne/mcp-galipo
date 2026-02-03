"""
User management database operations.

Provides CRUD functions for users with bcrypt password hashing.
"""

import bcrypt
from typing import Optional
from .connection import get_cursor, serialize_row, serialize_rows, _NOT_PROVIDED


# Bcrypt cost factor (12 is a good balance of security and performance)
BCRYPT_COST = 12


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(BCRYPT_COST)).decode('utf-8')


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against a bcrypt hash."""
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))


def get_user_by_id(user_id: int) -> Optional[dict]:
    """Get a user by their ID, including paralegal info if set."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT u.id, u.email, u.first_name, u.last_name, u.initials, u.bar_number,
                   u.position, u.is_admin, u.must_change_password, u.is_active,
                   u.paralegal_id, u.created_at, u.updated_at,
                   p.first_name as paralegal_first_name, p.last_name as paralegal_last_name,
                   p.initials as paralegal_initials
            FROM users u
            LEFT JOIN users p ON u.paralegal_id = p.id
            WHERE u.id = %s
        """, (user_id,))
        row = cur.fetchone()
        if not row:
            return None
        result = serialize_row(row)
        # Build nested paralegal object if exists
        if result.get('paralegal_id'):
            result['paralegal'] = {
                'id': result['paralegal_id'],
                'first_name': result.pop('paralegal_first_name'),
                'last_name': result.pop('paralegal_last_name'),
                'initials': result.pop('paralegal_initials'),
            }
        else:
            result.pop('paralegal_first_name', None)
            result.pop('paralegal_last_name', None)
            result.pop('paralegal_initials', None)
            result['paralegal'] = None
        return result


def get_user_by_email(email: str) -> Optional[dict]:
    """Get a user by their email address (includes password_hash for auth)."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT id, email, password_hash, first_name, last_name, initials,
                   bar_number, position, is_admin, must_change_password, is_active,
                   created_at, updated_at
            FROM users
            WHERE email = %s
        """, (email.lower(),))
        row = cur.fetchone()
        return serialize_row(row) if row else None


def get_all_users(include_inactive: bool = False) -> list[dict]:
    """Get all users, optionally including inactive ones."""
    with get_cursor() as cur:
        if include_inactive:
            cur.execute("""
                SELECT u.id, u.email, u.first_name, u.last_name, u.initials, u.bar_number,
                       u.position, u.is_admin, u.must_change_password, u.is_active,
                       u.paralegal_id, u.created_at, u.updated_at,
                       p.first_name as paralegal_first_name, p.last_name as paralegal_last_name,
                       p.initials as paralegal_initials
                FROM users u
                LEFT JOIN users p ON u.paralegal_id = p.id
                ORDER BY u.last_name, u.first_name
            """)
        else:
            cur.execute("""
                SELECT u.id, u.email, u.first_name, u.last_name, u.initials, u.bar_number,
                       u.position, u.is_admin, u.must_change_password, u.is_active,
                       u.paralegal_id, u.created_at, u.updated_at,
                       p.first_name as paralegal_first_name, p.last_name as paralegal_last_name,
                       p.initials as paralegal_initials
                FROM users u
                LEFT JOIN users p ON u.paralegal_id = p.id
                WHERE u.is_active = TRUE
                ORDER BY u.last_name, u.first_name
            """)
        rows = cur.fetchall()
        result = []
        for row in rows:
            user = serialize_row(row)
            if user.get('paralegal_id'):
                user['paralegal'] = {
                    'id': user['paralegal_id'],
                    'first_name': user.pop('paralegal_first_name'),
                    'last_name': user.pop('paralegal_last_name'),
                    'initials': user.pop('paralegal_initials'),
                }
            else:
                user.pop('paralegal_first_name', None)
                user.pop('paralegal_last_name', None)
                user.pop('paralegal_initials', None)
                user['paralegal'] = None
            result.append(user)
        return result


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
    password_hash = hash_password(password)

    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO users (email, password_hash, first_name, last_name, initials,
                              bar_number, position, is_admin, must_change_password)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, email, first_name, last_name, initials, bar_number,
                      position, is_admin, must_change_password, is_active,
                      created_at, updated_at
        """, (email.lower(), password_hash, first_name, last_name, initials,
              bar_number, position, is_admin, must_change_password))
        return serialize_row(cur.fetchone())


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
    updates = []
    params = []

    if email is not _NOT_PROVIDED:
        updates.append("email = %s")
        params.append(email.lower() if email else email)
    if first_name is not _NOT_PROVIDED:
        updates.append("first_name = %s")
        params.append(first_name)
    if last_name is not _NOT_PROVIDED:
        updates.append("last_name = %s")
        params.append(last_name)
    if initials is not _NOT_PROVIDED:
        updates.append("initials = %s")
        params.append(initials)
    if position is not _NOT_PROVIDED:
        updates.append("position = %s")
        params.append(position)
    if bar_number is not _NOT_PROVIDED:
        updates.append("bar_number = %s")
        params.append(bar_number)
    if is_admin is not _NOT_PROVIDED:
        updates.append("is_admin = %s")
        params.append(is_admin)
    if must_change_password is not _NOT_PROVIDED:
        updates.append("must_change_password = %s")
        params.append(must_change_password)
    if is_active is not _NOT_PROVIDED:
        updates.append("is_active = %s")
        params.append(is_active)
    if paralegal_id is not _NOT_PROVIDED:
        updates.append("paralegal_id = %s")
        params.append(paralegal_id)

    if not updates:
        return get_user_by_id(user_id)

    updates.append("updated_at = CURRENT_TIMESTAMP")
    params.append(user_id)

    with get_cursor() as cur:
        cur.execute(f"""
            UPDATE users
            SET {', '.join(updates)}
            WHERE id = %s
            RETURNING id
        """, params)
        row = cur.fetchone()
        if not row:
            return None
    # Re-fetch to include paralegal join
    return get_user_by_id(user_id)


def update_password(user_id: int, new_password: str, clear_must_change: bool = True) -> bool:
    """Update a user's password."""
    password_hash = hash_password(new_password)

    with get_cursor() as cur:
        if clear_must_change:
            cur.execute("""
                UPDATE users
                SET password_hash = %s, must_change_password = FALSE, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (password_hash, user_id))
        else:
            cur.execute("""
                UPDATE users
                SET password_hash = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (password_hash, user_id))
        return cur.rowcount > 0


def delete_user(user_id: int, hard_delete: bool = False) -> bool:
    """
    Delete a user. By default, performs a soft delete (is_active=False).
    Set hard_delete=True to permanently remove the user.
    """
    with get_cursor() as cur:
        if hard_delete:
            cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
        else:
            cur.execute("""
                UPDATE users
                SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (user_id,))
        return cur.rowcount > 0


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

    # Remove password_hash before returning
    del user['password_hash']
    return user


def get_attorneys_for_paralegal(paralegal_id: int) -> list[dict]:
    """Get all attorneys who have this paralegal assigned as their default."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT id, email, first_name, last_name, initials, bar_number,
                   position, is_admin, is_active, created_at, updated_at
            FROM users
            WHERE paralegal_id = %s AND is_active = TRUE
            ORDER BY last_name, first_name
        """, (paralegal_id,))
        return serialize_rows(cur.fetchall())
