import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context
from models import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Use DATABASE_URL from environment (same as the rest of the app)
# Normalize postgres:// to postgresql:// for SQLAlchemy compatibility
db_url = os.environ["DATABASE_URL"]
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)
config.set_main_option("sqlalchemy.url", db_url)

target_metadata = Base.metadata


def include_object(object, name, type_, reflected, compare_to):
    """Skip legacy/backup tables that still exist in the DB but aren't in our models."""
    if type_ == "table" and name in (
        "clients",
        "contacts",
        "defendants",
        "case_clients",
        "case_contacts",
        "case_defendants",
        "persons_backup",
        "person_types_backup",
        "case_persons_backup",
        "judges_backup",
        "schema_migrations",
    ):
        return False
    return True


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
