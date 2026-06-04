"""Vendor & platform reporting endpoints (backed by SQL views)."""

from __future__ import annotations

from decimal import Decimal

from tests.conftest import SEED_VARIANT_SKU


def _auth(client, email):
    client.post("/auth/register", json={
        "full_name": "U", "email": email, "password": "supersecret1",
    })
    token = client.post("/auth/login", data={
        "username": email, "password": "supersecret1",
    }).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _grant(db, email, role_key):
    from orm import AppUser, Role, UserRole
    user = db.query(AppUser).filter_by(email=email).one()
    role = db.query(Role).filter_by(role_key=role_key).one()
    db.add(UserRole(user_id=user.user_id, role_id=role.role_id))
    db.commit()


def _buy(client, headers, db, qty=2):
    from orm import ProductVariant
    vid = db.query(ProductVariant).filter_by(sku=SEED_VARIANT_SKU).one().variant_id
    client.post("/cart/items", json={"variant_id": vid, "quantity": qty}, headers=headers)
    order = client.post("/orders/checkout", json={"gateway": "cod"}, headers=headers).json()
    client.post(f"/orders/{order['order_id']}/pay/confirm", headers=headers)
    return order


def test_vendor_revenue_report_reflects_paid_sales(client, db):
    admin = _auth(client, "rep-admin@example.com")
    _grant(db, "rep-admin@example.com", "admin")  # admin has reports.platform

    buyer = _auth(client, "rep-buyer@example.com")
    order = _buy(client, buyer, db, qty=2)  # 2 x 10.000 = 20.000, 10% commission
    vendor_id = order["items"][0]["vendor_id"]

    r = client.get(f"/vendors/{vendor_id}/reports/revenue", headers=admin)
    assert r.status_code == 200, r.text
    body = r.json()
    # The shared vendor accrues across the suite, so assert monotonic minimums.
    assert body["orders_count"] >= 1
    assert Decimal(str(body["gross_sales"])) >= Decimal("20.000")
    # net = gross - commission, always 90% here.
    assert Decimal(str(body["net_vendor_earnings"])) == \
        Decimal(str(body["gross_sales"])) - Decimal(str(body["platform_commission"]))


def test_vendor_reports_access_control(client, db):
    # An unrelated customer cannot read a vendor's reports.
    outsider = _auth(client, "rep-out@example.com")
    assert client.get("/vendors/1/reports/revenue", headers=outsider).status_code == 403
    assert client.get("/vendors/1/reports/low-stock", headers=outsider).status_code == 403

    # A user linked to the vendor via vendor_staff can.
    from orm import AppUser, Role, VendorStaff
    staff = _auth(client, "rep-staff@example.com")
    user = db.query(AppUser).filter_by(email="rep-staff@example.com").one()
    role = db.query(Role).filter_by(role_key="vendor_owner").one()
    db.add(VendorStaff(vendor_id=1, user_id=user.user_id, role_id=role.role_id))
    db.commit()
    assert client.get("/vendors/1/reports/revenue", headers=staff).status_code == 200
    assert client.get("/vendors/1/reports/low-stock", headers=staff).status_code == 200


def test_platform_monthly_revenue_requires_permission(client, db):
    plain = _auth(client, "rep-plain@example.com")
    assert client.get("/reports/platform/monthly-revenue", headers=plain).status_code == 403

    admin = _auth(client, "rep-admin2@example.com")
    _grant(db, "rep-admin2@example.com", "admin")
    r = client.get("/reports/platform/monthly-revenue", headers=admin)
    assert r.status_code == 200
    assert isinstance(r.json(), list)
