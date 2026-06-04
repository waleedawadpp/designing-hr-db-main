"""Pytest fixtures: a fresh schema + seeded RBAC and a TestClient per session.

Requires a reachable PostgreSQL. Point RAF_DATABASE_URL at a *disposable*
database (the suite drops and recreates the public schema).
"""

from __future__ import annotations

import pathlib

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db import SessionLocal, engine
from app.main import app
from app.security import hash_password
from orm import (
    AppUser, Inventory, Permission, Product, ProductStatus, ProductVariant,
    Role, RolePermission, UserStatus, Vendor, VendorStatus,
)

# Stable identifiers the test suite relies on.
SEED_VARIANT_SKU = "SEED-SKU-1"
SEED_VARIANT_PRICE = "10.000"
SEED_INVENTORY_QTY = 50

_SCHEMA_SQL = pathlib.Path(__file__).resolve().parents[2] / "schema.sql"
_VIEWS_SQL = pathlib.Path(__file__).resolve().parents[2] / "views.sql"


def _reset_schema() -> None:
    sql = _SCHEMA_SQL.read_text(encoding="utf-8").replace("BEGIN;", "").replace("COMMIT;", "")
    views = _VIEWS_SQL.read_text(encoding="utf-8").replace("BEGIN;", "").replace("COMMIT;", "")
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
        conn.execute(text(sql))
        conn.execute(text(views))


def _seed_rbac() -> None:
    with SessionLocal() as db:
        roles = {
            "customer": ("عميل", "Customer"),
            "vendor_owner": ("صاحب متجر", "Vendor Owner"),
            "vendor_staff": ("موظف متجر", "Vendor Staff"),
            "admin": ("مدير", "Administrator"),
        }
        for key, (ar, en) in roles.items():
            db.add(Role(role_key=key, name_ar=ar, name_en=en))
        for pk in ("product.create", "vendor.approve", "order.manage",
                   "reports.platform", "marketing.manage", "product.moderate",
                   "catalog.manage", "payout.process"):
            db.add(Permission(perm_key=pk, description=pk))
        db.flush()

        admin = next(r for r in db.query(Role).all() if r.role_key == "admin")
        vowner = next(r for r in db.query(Role).all() if r.role_key == "vendor_owner")
        perms = {p.perm_key: p for p in db.query(Permission).all()}
        # admin: all perms; vendor_owner: product.create + order.manage
        for p in perms.values():
            db.add(RolePermission(role_id=admin.role_id, permission_id=p.permission_id))
        for pk in ("product.create", "order.manage"):
            db.add(RolePermission(role_id=vowner.role_id,
                                  permission_id=perms[pk].permission_id))
        db.commit()

        # A vendor (vendor_id=1) so product-create tests satisfy the FK.
        owner = AppUser(
            full_name="Seed Owner", email="seed-owner@example.com",
            password_hash=hash_password("seedpassword1"), status=UserStatus.active,
        )
        db.add(owner)
        db.flush()
        vendor = Vendor(
            owner_user_id=owner.user_id, store_name_ar="متجر", store_name_en="Seed Store",
            slug="seed-store", status=VendorStatus.approved,  # commission_rate defaults to 10.00
        )
        db.add(vendor)
        db.flush()

        # A published product with one variant + stock, for cart/checkout tests.
        product = Product(
            vendor_id=vendor.vendor_id, name_ar="منتج", name_en="Seed Product",
            slug="seed-product", base_price=SEED_VARIANT_PRICE, status=ProductStatus.published,
        )
        db.add(product)
        db.flush()
        variant = ProductVariant(
            product_id=product.product_id, sku=SEED_VARIANT_SKU, price=SEED_VARIANT_PRICE,
        )
        db.add(variant)
        db.flush()
        db.add(Inventory(variant_id=variant.variant_id, quantity=SEED_INVENTORY_QTY))
        db.commit()


@pytest.fixture(scope="session", autouse=True)
def _database():
    _reset_schema()
    _seed_rbac()
    yield


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture()
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
