"""Returns & refunds: eligibility, approval, completion (refund/restock/wallet)."""

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


def _grant_order_manage(db, email):
    from orm import AppUser, Role, UserRole
    user = db.query(AppUser).filter_by(email=email).one()
    role = db.query(Role).filter_by(role_key="vendor_owner").one()
    db.add(UserRole(user_id=user.user_id, role_id=role.role_id))
    db.commit()


def _paid_order(client, headers, db, qty=2):
    from orm import ProductVariant
    vid = db.query(ProductVariant).filter_by(sku=SEED_VARIANT_SKU).one().variant_id
    client.post("/cart/items", json={"variant_id": vid, "quantity": qty}, headers=headers)
    order = client.post("/orders/checkout", json={"gateway": "cod"}, headers=headers).json()
    client.post(f"/orders/{order['order_id']}/pay/confirm", headers=headers)
    return order, vid


def test_partial_then_full_return_refund_restock_wallet(client, db):
    from orm import Inventory, VendorWallet

    buyer = _auth(client, "ret-buyer@example.com")
    order, vid = _paid_order(client, buyer, db, qty=2)  # 2 x 10.000 = 20.000
    item = order["items"][0]
    vendor_id = item["vendor_id"]

    # Measure deltas (the seeded vendor/inventory is shared across the suite).
    db.expire_all()
    wallet_after_purchase = db.get(VendorWallet, vendor_id).available_balance
    stock_after_purchase = db.get(Inventory, vid).quantity

    staff = _auth(client, "ret-staff@example.com")
    _grant_order_manage(db, "ret-staff@example.com")

    # Request a return for 1 unit.
    r = client.post("/returns", headers=buyer,
                    json={"order_item_id": item["order_item_id"], "quantity": 1, "reason": "size"})
    assert r.status_code == 201, r.text
    rid = r.json()["return_id"]
    assert r.json()["status"] == "requested"

    # Approve, then complete.
    assert client.post(f"/returns/{rid}/approve", headers=staff).status_code == 200
    r = client.post(f"/returns/{rid}/complete", headers=staff)
    assert r.status_code == 200, r.text
    resolved = r.json()
    assert resolved["status"] == "completed"
    assert Decimal(str(resolved["refund"]["amount"])) == Decimal("10.000")  # 1 x 10.000

    db.expire_all()
    # Restocked by 1.
    assert db.get(Inventory, vid).quantity == stock_after_purchase + 1
    # Vendor debited net of commission: 10 - 1 = 9.000
    assert db.get(VendorWallet, vendor_id).available_balance == wallet_after_purchase - Decimal("9.000")
    # Payment partially refunded.
    assert client.get(f"/orders/{order['order_id']}", headers=buyer).json()["payment"]["status"] \
        == "partially_refunded"

    # Return the remaining unit -> fully refunded, order refunded.
    r = client.post("/returns", headers=buyer,
                    json={"order_item_id": item["order_item_id"], "quantity": 1})
    rid2 = r.json()["return_id"]
    client.post(f"/returns/{rid2}/approve", headers=staff)
    client.post(f"/returns/{rid2}/complete", headers=staff)

    db.expire_all()
    # Both units restocked; vendor fully debited the net proceeds (18.000).
    assert db.get(Inventory, vid).quantity == stock_after_purchase + 2
    assert db.get(VendorWallet, vendor_id).available_balance == wallet_after_purchase - Decimal("18.000")
    order_detail = client.get(f"/orders/{order['order_id']}", headers=buyer).json()
    assert order_detail["status"] == "refunded"
    assert order_detail["payment"]["status"] == "refunded"


def test_return_quantity_cannot_exceed_purchased(client, db):
    buyer = _auth(client, "ret-qty@example.com")
    order, _ = _paid_order(client, buyer, db, qty=1)
    item = order["items"][0]
    r = client.post("/returns", headers=buyer,
                    json={"order_item_id": item["order_item_id"], "quantity": 2})
    assert r.status_code == 400


def test_return_requires_ownership_and_approval_flow(client, db):
    buyer = _auth(client, "ret-own@example.com")
    order, _ = _paid_order(client, buyer, db, qty=1)
    item = order["items"][0]

    # A different user cannot open a return on someone else's item.
    other = _auth(client, "ret-other@example.com")
    assert client.post("/returns", headers=other,
                       json={"order_item_id": item["order_item_id"], "quantity": 1}).status_code == 404

    rid = client.post("/returns", headers=buyer,
                      json={"order_item_id": item["order_item_id"], "quantity": 1}).json()["return_id"]

    # Completing before approval is rejected.
    staff = _auth(client, "ret-own-staff@example.com")
    _grant_order_manage(db, "ret-own-staff@example.com")
    assert client.post(f"/returns/{rid}/complete", headers=staff).status_code == 409

    # Buyer (no order.manage) cannot approve.
    assert client.post(f"/returns/{rid}/approve", headers=buyer).status_code == 403

    # Reject works and is terminal.
    assert client.post(f"/returns/{rid}/reject", headers=staff).status_code == 200
    assert client.post(f"/returns/{rid}/approve", headers=staff).status_code == 409
