"""Database engine and FastAPI session dependency.

The ORM models live in the sibling ``orm`` package (``RAF_Marketplace_DB/orm``);
we add that directory to ``sys.path`` so ``import orm`` works regardless of how
the backend is launched.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

# Make the top-level `orm` package importable.
_DB_ROOT = Path(__file__).resolve().parents[2]  # .../RAF_Marketplace_DB
if str(_DB_ROOT) not in sys.path:
    sys.path.insert(0, str(_DB_ROOT))

from app.config import settings  # noqa: E402

engine = create_engine(settings.database_url, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)


def get_db() -> Iterator[Session]:
    """Yield a transactional session, closed after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
