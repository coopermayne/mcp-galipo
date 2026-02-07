"""SQLAlchemy session factory — the sole database connection layer.

Usage in db/ modules:
    from db.session import SessionLocal

    def get_jurisdictions():
        with SessionLocal() as session:
            return session.scalars(select(Jurisdiction).order_by(Jurisdiction.name)).all()

Usage as a FastAPI dependency:
    from db.session import get_session

    @router.get("/api/v1/jurisdictions")
    async def list_jurisdictions(session = Depends(get_session)):
        ...
"""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Re-export the sentinel from connection.py so all modules share the same object.
# Routes use `db._NOT_PROVIDED` (from db/__init__ → connection.py), and migrated
# modules use `from .session import _NOT_PROVIDED` — these must be identical.
from .connection import _NOT_PROVIDED  # noqa: F401

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL environment variable is not set. "
        "Make sure to export it: set -a && source .env && set +a"
    )

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)


def get_session():
    """FastAPI dependency that yields a SQLAlchemy session."""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
