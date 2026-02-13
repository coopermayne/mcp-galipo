"""
Database initialization and seeding.

Uses SQLAlchemy engine (from db/session.py) for all operations.
The psycopg2 connection pool has been removed — SQLAlchemy is the sole DB layer.
"""

from .validation import DEFAULT_JURISDICTIONS, DEFAULT_EXPERTISE_TYPES

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
            email="cmayne@galipolaw.com",
            password_hash="$2b$12$RIH.48YzoKP8OWUh6hOxLORtkaHd2.9WqKKCzpv4cbUZaXODHA/N2",
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


def seed_objections():
    """Seed default legal objections if the table is empty."""
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from models import Objection
    from .session import SessionLocal

    DEFAULT_OBJECTIONS = [
        {
            "name": "Vague and Ambiguous",
            "short_name": "vague",
            "formal_language": "Responding Party objects to this request on the grounds that it is vague and ambiguous, rendering it impossible to determine the nature and scope of the information sought.",
            "position": 0,
        },
        {
            "name": "Overbroad",
            "short_name": "overbroad",
            "formal_language": "Responding Party objects to this request on the grounds that it is overbroad in scope and not reasonably particularized to the subject matter of this litigation.",
            "position": 1,
        },
        {
            "name": "Attorney-Client Privilege",
            "short_name": "attorney_client",
            "formal_language": "Responding Party objects to this request to the extent it seeks information protected by the attorney-client privilege. Any such information will not be produced.",
            "position": 2,
        },
        {
            "name": "Work Product Doctrine",
            "short_name": "work_product",
            "formal_language": "Responding Party objects to this request to the extent it seeks documents or tangible things prepared in anticipation of litigation or for trial by or for the Responding Party, which are protected from disclosure under the work product doctrine.",
            "position": 3,
        },
        {
            "name": "Not Relevant",
            "short_name": "relevance",
            "formal_language": "Responding Party objects to this request on the grounds that it is not relevant to the subject matter of this action and is not reasonably calculated to lead to the discovery of admissible evidence.",
            "position": 4,
        },
        {
            "name": "Unduly Burdensome",
            "short_name": "burdensome",
            "formal_language": "Responding Party objects to this request on the grounds that it is unduly burdensome and oppressive, and that the burden and expense of the proposed discovery outweighs its likely benefit.",
            "position": 5,
        },
        {
            "name": "Compound",
            "short_name": "compound",
            "formal_language": "Responding Party objects to this request on the grounds that it is compound, containing multiple discrete subparts that should be propounded as separate requests.",
            "position": 6,
        },
        {
            "name": "Right to Privacy",
            "short_name": "privacy",
            "formal_language": "Responding Party objects to this request to the extent it seeks information protected by the right to privacy of the Responding Party and/or third parties under Article I, Section 1 of the California Constitution.",
            "position": 7,
        },
        {
            "name": "Equally Available",
            "short_name": "equally_available",
            "formal_language": "Responding Party objects to this request on the grounds that the information sought is equally available to the Propounding Party through its own investigation or from public sources.",
            "position": 8,
        },
        {
            "name": "Trade Secret",
            "short_name": "trade_secret",
            "formal_language": "Responding Party objects to this request to the extent it seeks information constituting trade secrets or other confidential proprietary business information.",
            "position": 9,
        },
    ]

    with SessionLocal() as session:
        count = session.query(Objection).count()
        if count > 0:
            return  # Already seeded

        for obj in DEFAULT_OBJECTIONS:
            stmt = pg_insert(Objection).values(**obj).on_conflict_do_nothing(
                index_elements=["short_name"]
            )
            session.execute(stmt)
        session.commit()
    print(f"Seeded {len(DEFAULT_OBJECTIONS)} default objections.")


def seed_db():
    """Seed all lookup tables and users."""
    seed_admin_user()
    seed_jurisdictions()
    seed_expertise_types()
    seed_roles()
    seed_objections()
    print("Database seeded with lookup data.")

    # Seed dev users if in a verified dev environment
    # This is safe: only runs on localhost + galipo_2/galipo_3 databases
    from .dev_users import seed_dev_users
    seed_dev_users()
