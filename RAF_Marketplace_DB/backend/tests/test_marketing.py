"""Marketing: coupon creation and discount application at checkout."""

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


def _admin(client, db, email):
    from orm import AppUser, Role, UserRole
    h = _auth(client, email)
    user = db.query(AppUser).filter_by(email=email).one()
    role = db.query(Role).filter_by(role_key="admin").one()
    db.add(UserRole(user_id=user.user_id, role_id=role.role_id))
    db.commit()
    return h


def _add_to_cart(client, headers, db, qty):
    from orm import ProductVariant
    vid = db.query(ProductVariant).filter_by(sku=SEED_VARIANT_SKU).one().variant_id
    client.post("/cart/items", json={"variant_id": vid, "quantity": qty}, headers=headers)


def _checkout(client, headers, **body):
    return client.post("/orders/checkout", json={"gateway": "cod", **body}, headers=headers)


def test_percent_coupon_applied_at_checkout(client, db):
    admin = _admin(client, db, "mk-admin@example.com")
    r = client.post("/coupons", headers=admin, json={
        "code": "SAVE10", "discount_type": "percent", "discount_value": "10",
    })
    assert r.status_code == 201, r.text

    buyer = _auth(client, "mk-buyer@example.com")
    _add_to_cart(client, buyer, db, qty=2)  # 2 x 10.000 = 20.000
    r = _checkout(client, buyer, coupon_code="SAVE10")
    assert r.status_code == 201, r.text
    order = r.json()
    assert Decimal(str(order["discount_total"])) == Decimal("2.000")   # 10% of 20
    assert Decimal(str(order["grand_total"])) == Decimal("18.000")
    assert Decimal(str(order["payment"]["amount"])) == Decimal("18.000")

    # used_count incremented.
    coupons = {c["code"]: c for c in client.get("/coupons", headers=admin).json()}
    assert coupons["SAVE10"]["used_count"] == 1


def test_fixed_coupon_and_invalid_code(client, db):
    admin = _admin(client, db, "mk-admin2@example.com")
    client.post("/coupons", headers=admin, json={
        "code": "FLAT5", "discount_type": "fixed", "discount_value": "5.000",
    })

    buyer = _auth(client, "mk-buyer2@example.com")
    _add_to_cart(client, buyer, db, qty=2)
    order = _checkout(client, buyer, coupon_code="FLAT5").json()
    assert Decimal(str(order["grand_total"])) == Decimal("15.000")     # 20 - 5

    # Unknown code is rejected.
    _add_to_cart(client, buyer, db, qty=1)
    assert _checkout(client, buyer, coupon_code="NOPE").status_code == 422


def test_min_order_total_and_usage_limit(client, db):
    admin = _admin(client, db, "mk-admin3@example.com")
    client.post("/coupons", headers=admin, json={
        "code": "BIG100", "discount_type": "fixed", "discount_value": "5.000",
        "min_order_total": "100.000",
    })
    client.post("/coupons", headers=admin, json={
        "code": "ONCE", "discount_type": "fixed", "discount_value": "3.000",
        "usage_limit": 1,
    })

    buyer = _auth(client, "mk-buyer3@example.com")

    # min_order_total not met (subtotal 20 < 100).
    _add_to_cart(client, buyer, db, qty=2)
    assert _checkout(client, buyer, coupon_code="BIG100").status_code == 422

    # First use of ONCE succeeds, second is over the limit.
    assert _checkout(client, buyer, coupon_code="ONCE").status_code == 201
    _add_to_cart(client, buyer, db, qty=1)
    assert _checkout(client, buyer, coupon_code="ONCE").status_code == 422


def test_coupon_creation_permissions_and_duplicates(client, db):
    # Plain user cannot create coupons.
    plain = _auth(client, "mk-plain@example.com")
    assert client.post("/coupons", headers=plain, json={
        "code": "X", "discount_type": "percent", "discount_value": "5",
    }).status_code == 403

    admin = _admin(client, db, "mk-admin4@example.com")
    assert client.post("/coupons", headers=admin, json={
        "code": "DUP", "discount_type": "percent", "discount_value": "5",
    }).status_code == 201
    # Duplicate code -> 409.
    assert client.post("/coupons", headers=admin, json={
        "code": "DUP", "discount_type": "percent", "discount_value": "5",
    }).status_code == 409
    # >100% percentage -> 422.
    assert client.post("/coupons", headers=admin, json={
        "code": "TOOBIG", "discount_type": "percent", "discount_value": "150",
    }).status_code == 422
