"""Alembic environment — wired to the app settings and ORM metadata."""

from __future__ import annotations

from logging.config import fileConfig

from alembic import context

from app.db import engine  # normalized engine (also ensures `orm` is importable)
from orm import Base

config = context.config
# Use the app's normalized URL (accepts managed hosts' postgres:// form).
# Escape '%' so ConfigParser interpolation never trips on URL-encoded chars.
_url = engine.url.render_as_string(hide_password=False)
config.set_main_option("sqlalchemy.url", _url.replace("%", "%%"))

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Autogenerate compares against the ORM metadata.
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=engine.url.render_as_string(hide_password=False),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
