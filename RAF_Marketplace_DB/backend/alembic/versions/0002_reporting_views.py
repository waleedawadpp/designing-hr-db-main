"""Reporting & analytics views.

Applies the canonical ``views.sql`` (revenue, low-stock, trends, etc.) on top
of the base schema so the reporting endpoints can query them.

Revision ID: 0002_reporting_views
Revises: 0001_initial_schema
Create Date: 2026-06-04
"""
from pathlib import Path
from typing import Sequence, Union

from alembic import op

revision: str = "0002_reporting_views"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# .../RAF_Marketplace_DB/views.sql
_VIEWS_SQL = Path(__file__).resolve().parents[3] / "views.sql"

_VIEWS = [
    "v_low_stock", "v_pending_vendors", "v_vendor_revenue", "v_monthly_revenue",
    "v_top_products", "v_customer_summary", "v_demand_forecast", "v_product_trends",
]


def upgrade() -> None:
    sql = _VIEWS_SQL.read_text(encoding="utf-8").replace("BEGIN;", "").replace("COMMIT;", "")
    op.execute(sql)


def downgrade() -> None:
    for view in _VIEWS:
        op.execute(f"DROP VIEW IF EXISTS {view} CASCADE;")
