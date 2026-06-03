"""Initial RAF Marketplace schema.

Applies the canonical ``schema.sql`` so the SQL file remains the single source
of truth for the structure; the ORM metadata is used for autogenerate of
*subsequent* migrations.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-06-03
"""
from pathlib import Path
from typing import Sequence, Union

from alembic import op

revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# .../RAF_Marketplace_DB/schema.sql
_SCHEMA_SQL = Path(__file__).resolve().parents[3] / "schema.sql"


def upgrade() -> None:
    sql = _SCHEMA_SQL.read_text(encoding="utf-8")
    # Alembic already runs inside a transaction; strip the file's own control.
    sql = sql.replace("BEGIN;", "").replace("COMMIT;", "")
    op.execute(sql)


def downgrade() -> None:
    # Drop everything (tables + enum types), then restore Alembic's own
    # bookkeeping table so it can record the version change.
    op.execute(
        "DROP SCHEMA public CASCADE; "
        "CREATE SCHEMA public; "
        "CREATE TABLE alembic_version ("
        "version_num VARCHAR(32) NOT NULL, "
        "CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)); "
        # Re-seed the current version so Alembic's own post-step DELETE
        # matches exactly one row (it deletes this revision next).
        "INSERT INTO alembic_version (version_num) VALUES ('0001_initial_schema');"
    )
