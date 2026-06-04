"""Cart → checkout → payment flow, including commission and inventory effects."""

from __future__ import annotations

from decimal import Decimal

from tests.conftest import SEED_VARIANT_SKU


def money(value) -> Decimal:
    """Coerce a JSON money field (string or float) to Decimal for comparison."""
    return Decimal(str(value))


def _auth(client, email):
    client.post("/auth/register", json={
        "full_name": "Buyer", "email": email, "password": "supersecret1",
    })
    token = client.post("/auth/login", data={
        "username": email, "password": "supersecret1",
    }).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _variant_id(db):
    from orm import ProductVariant
    return db.query(ProductVariant).filter_by(sku=SEED_VARIANT_SKU).one().variant_id


def test_cart_add_and_view(client, db):
    h = _auth(client, "cart1@example.com")
    vid = _variant_id(db)

    r = client.post("/cart/items", json={"variant_id": vid, "quantity": 2}, headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert money(body["subtotal"]) == Decimal("20.000")  # 2 x 10.000
    assert body["items"][0]["sku"] == SEED_VARIANT_SKU

    # Adding the same variant accumulates quantity.
    r = client.post("/cart/items", json={"variant_id": vid, "quantity": 1}, headers=h)
    assert r.json()["items"][0]["quantity"] == 3


def test_checkout_unknown_gateway_rejected(client, db):
    h = _auth(client, "gw@example.com")
    vid = _variant_id(db)
    client.post("/cart/items", json={"variant_id": vid, "quantity": 1}, headers=h)
    r = client.post("/orders/checkout", json={"gateway": "bitcoin"}, headers=h)
    assert r.status_code == 422


def test_checkout_empty_cart_rejected(client):
    h = _auth(client, "empty@example.com")
    r = client.post("/orders/checkout", json={"gateway": "cod"}, headers=h)
    assert r.status_code == 400


def test_full_checkout_and_payment_flow(client, db):
    from orm import Inventory, VendorWallet

    from orm import Product, ProductVariant

    h = _auth(client, "flow@example.com")
    vid = _variant_id(db)
    qty = 3
    # Baseline (the seed variant/vendor is shared across the suite).
    db.expire_all()
    inv0 = db.get(Inventory, vid)
    q0, r0 = inv0.quantity, inv0.reserved
    vendor_id0 = db.get(Product, db.get(ProductVariant, vid).product_id).vendor_id
    wallet0 = db.get(VendorWallet, vendor_id0)
    balance0 = wallet0.available_balance if wallet0 else Decimal("0")
    client.post("/cart/items", json={"variant_id": vid, "quantity": qty}, headers=h)

    # Checkout
    r = client.post("/orders/checkout", json={"gateway": "cod"}, headers=h)
    assert r.status_code == 201, r.text
    order = r.json()
    assert order["order_number"].startswith("RAF-")
    assert order["status"] == "pending"
    assert money(order["grand_total"]) == Decimal("30.000")          # 3 x 10.000
    assert order["payment"]["status"] == "pending"
    assert money(order["items"][0]["commission_amount"]) == Decimal("3.000")  # 10% of 30.000
    order_id = order["order_id"]

    # Stock is reserved, not yet deducted.
    db.expire_all()
    inv = db.get(Inventory, vid)
    assert inv.quantity == q0
    assert inv.reserved == r0 + qty
    vendor_id = order["items"][0]["vendor_id"]

    # Cart is now empty.
    assert client.get("/cart", headers=h).json()["items"] == []

    # Confirm payment
    r = client.post(f"/orders/{order_id}/pay/confirm", headers=h)
    assert r.status_code == 200, r.text
    confirmed = r.json()
    assert confirmed["status"] == "confirmed"
    assert confirmed["payment"]["status"] == "paid"

    # Stock deducted, reservation released back to baseline.
    db.expire_all()
    inv = db.get(Inventory, vid)
    assert inv.quantity == q0 - qty
    assert inv.reserved == r0

    # Vendor credited net of 10% commission: 30.000 - 3.000 = 27.000
    assert db.get(VendorWallet, vendor_id).available_balance == balance0 + Decimal("27.000")

    # Confirming again is idempotent.
    r = client.post(f"/orders/{order_id}/pay/confirm", headers=h)
    assert r.status_code == 200
    db.expire_all()
    assert db.get(VendorWallet, vendor_id).available_balance == balance0 + Decimal("27.000")


def test_orders_are_scoped_to_owner(client, db):
    buyer = _auth(client, "owner-a@example.com")
    vid = _variant_id(db)
    client.post("/cart/items", json={"variant_id": vid, "quantity": 1}, headers=buyer)
    oid = client.post("/orders/checkout", json={"gateway": "cod"}, headers=buyer).json()["order_id"]

    other = _auth(client, "owner-b@example.com")
    assert client.get(f"/orders/{oid}", headers=other).status_code == 404
    assert client.get(f"/orders/{oid}", headers=buyer).status_code == 200


def test_listing_my_orders(client, db):
    h = _auth(client, "lister@example.com")
    vid = _variant_id(db)
    client.post("/cart/items", json={"variant_id": vid, "quantity": 1}, headers=h)
    client.post("/orders/checkout", json={"gateway": "stripe"}, headers=h)
    r = client.get("/orders", headers=h)
    assert r.status_code == 200
    assert len(r.json()) >= 1
