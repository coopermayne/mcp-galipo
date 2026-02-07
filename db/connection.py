"""
Database initialization and seeding.

Uses SQLAlchemy engine (from db/session.py) for all operations.
The psycopg2 connection pool has been removed — SQLAlchemy is the sole DB layer.
"""

import os
from .validation import DEFAULT_JURISDICTIONS, DEFAULT_EXPERTISE_TYPES

DATABASE_URL = os.environ.get("DATABASE_URL")

# Sentinel value to distinguish "not provided" from "explicitly set to None/null"
_NOT_PROVIDED = object()


def init_db():
    """Create all tables if they don't exist, using SQLAlchemy metadata."""
    from models import Base
    from .session import engine
    Base.metadata.create_all(engine)
    print("Database tables initialized.")


def drop_all_tables():
    """Drop all existing tables for clean reset."""
    from models import Base
    from .session import engine
    Base.metadata.drop_all(engine)
    print("All tables dropped.")


def seed_admin_user():
    """Seed the admin user for production. Idempotent (ON CONFLICT DO NOTHING)."""
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from models import User
    from .session import SessionLocal

    with SessionLocal() as session:
        stmt = pg_insert(User).values(
            email="cmayne@example.com",
            password_hash="REDACTED-PASSWORD-HASH",
            first_name="Cooper",
            last_name="Mayne",
            initials="CM",
            bar_number="343691",
            position="attorney",
            is_admin=True,
            must_change_password=True,
        ).on_conflict_do_nothing(index_elements=["email"])
        session.execute(stmt)
        session.commit()


def seed_jurisdictions():
    """Seed initial jurisdictions if the table is empty."""
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from models import Jurisdiction
    from .session import SessionLocal

    with SessionLocal() as session:
        count = session.query(Jurisdiction).count()
        if count > 0:
            return  # Already seeded

        for j in DEFAULT_JURISDICTIONS:
            stmt = pg_insert(Jurisdiction).values(
                name=j["name"],
                local_rules_link=j.get("local_rules_link"),
            ).on_conflict_do_nothing(index_elements=["name"])
            session.execute(stmt)
        session.commit()
    print(f"Seeded {len(DEFAULT_JURISDICTIONS)} jurisdictions.")


def seed_expertise_types():
    """Seed initial expertise types if the table is empty."""
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from models import ExpertiseType
    from .session import SessionLocal

    with SessionLocal() as session:
        count = session.query(ExpertiseType).count()
        if count > 0:
            return  # Already seeded

        for name in DEFAULT_EXPERTISE_TYPES:
            stmt = pg_insert(ExpertiseType).values(
                name=name,
            ).on_conflict_do_nothing(index_elements=["name"])
            session.execute(stmt)
        session.commit()
    print(f"Seeded {len(DEFAULT_EXPERTISE_TYPES)} expertise types.")


def seed_roles():
    """Seed initial roles if the table is empty.

    Roles are seeded from DEFAULT_ROLES in validation.py.
    """
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from models import Role
    from .session import SessionLocal
    from .validation import DEFAULT_ROLES

    with SessionLocal() as session:
        count = session.query(Role).count()
        if count > 0:
            return  # Already seeded

        for role in DEFAULT_ROLES:
            stmt = pg_insert(Role).values(
                name=role["name"],
                category=role["category"],
                sort_order=role["sort_order"],
            ).on_conflict_do_nothing(index_elements=["name"])
            session.execute(stmt)
        session.commit()
    print(f"Seeded {len(DEFAULT_ROLES)} roles.")


def seed_db():
    """Seed all lookup tables and users."""
    seed_admin_user()
    seed_jurisdictions()
    seed_expertise_types()
    seed_roles()
    print("Database seeded with lookup data.")

    # Seed dev users if in a verified dev environment
    # This is safe: only runs on localhost + galipo_2/galipo_3 databases
    from .dev_users import seed_dev_users
    seed_dev_users()
