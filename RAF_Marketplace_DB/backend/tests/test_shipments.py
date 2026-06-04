"""Shipping & tracking: shipment creation, event timeline, order roll-up, access."""

from __future__ import annotations

from tests.conftest import SEED_VARIANT_SKU


def _token(client, email):
    client.post("/auth/register", json={
        "full_name": "U", "email": email, "password": "supersecret1",
    })
    return client.post("/auth/login", data={
        "username": email, "password": "supersecret1",
    }).json()["access_token"]


def _auth(client, email):
    return {"Authorization": f"Bearer {_token(client, email)}"}


def _grant_order_manage(db, email):
    from orm import AppUser, Role, UserRole
    user = db.query(AppUser).filter_by(email=email).one()
    role = db.query(Role).filter_by(role_key="vendor_owner").one()  # has order.manage
    db.add(UserRole(user_id=user.user_id, role_id=role.role_id))
    db.commit()


def _place_order(client, headers, db):
    from orm import ProductVariant
    vid = db.query(ProductVariant).filter_by(sku=SEED_VARIANT_SKU).one().variant_id
    client.post("/cart/items", json={"variant_id": vid, "quantity": 1}, headers=headers)
    return client.post("/orders/checkout", json={"gateway": "cod"}, headers=headers).json()


def test_shipment_lifecycle_and_order_rollup(client, db):
    buyer = _auth(client, "ship-buyer@example.com")
    order = _place_order(client, buyer, db)
    order_id = order["order_id"]
    vendor_id = order["items"][0]["vendor_id"]

    fulfil = _auth(client, "fulfil@example.com")
    _grant_order_manage(db, "fulfil@example.com")

    # Create the shipment.
    r = client.post(f"/orders/{order_id}/shipments", headers=fulfil,
                    json={"vendor_id": vendor_id, "carrier": "aramex", "tracking_number": "AR123"})
    assert r.status_code == 201, r.text
    sid = r.json()["shipment_id"]
    assert r.json()["status"] == "pending"

    # Post a tracking timeline.
    for status in ("picked_up", "in_transit", "out_for_delivery"):
        r = client.post(f"/shipments/{sid}/events", headers=fulfil, json={"status": status})
        assert r.status_code == 201, r.text

    # Order should now be "shipped" while in transit.
    assert client.get(f"/orders/{order_id}", headers=buyer).json()["status"] == "shipped"

    # Deliver it.
    r = client.post(f"/shipments/{sid}/events", headers=fulfil,
                    json={"status": "delivered", "location": "Muscat"})
    assert r.status_code == 201
    detail = r.json()
    assert detail["status"] == "delivered"
    assert detail["delivered_at"] is not None
    assert len(detail["events"]) == 4

    # Order rolls up to delivered once all shipments are delivered.
    assert client.get(f"/orders/{order_id}", headers=buyer).json()["status"] == "delivered"


def test_buyer_can_track_but_outsiders_cannot(client, db):
    buyer = _auth(client, "track-buyer@example.com")
    order = _place_order(client, buyer, db)
    order_id = order["order_id"]
    vendor_id = order["items"][0]["vendor_id"]

    fulfil = _auth(client, "track-fulfil@example.com")
    _grant_order_manage(db, "track-fulfil@example.com")
    sid = client.post(f"/orders/{order_id}/shipments", headers=fulfil,
                      json={"vendor_id": vendor_id, "carrier": "dhl"}).json()["shipment_id"]

    # Owner can see the shipment + its order list.
    assert client.get(f"/shipments/{sid}", headers=buyer).status_code == 200
    assert len(client.get(f"/orders/{order_id}/shipments", headers=buyer).json()) == 1

    # A different user cannot.
    other = _auth(client, "track-other@example.com")
    assert client.get(f"/shipments/{sid}", headers=other).status_code == 404
    assert client.get(f"/orders/{order_id}/shipments", headers=other).status_code == 404


def test_shipment_validation_and_permissions(client, db):
    buyer = _auth(client, "val-buyer@example.com")
    order = _place_order(client, buyer, db)
    order_id = order["order_id"]
    vendor_id = order["items"][0]["vendor_id"]

    # Without order.manage permission -> 403.
    assert client.post(f"/orders/{order_id}/shipments", headers=buyer,
                       json={"vendor_id": vendor_id, "carrier": "aramex"}).status_code == 403

    fulfil = _auth(client, "val-fulfil@example.com")
    _grant_order_manage(db, "val-fulfil@example.com")

    # Unknown carrier -> 422.
    assert client.post(f"/orders/{order_id}/shipments", headers=fulfil,
                       json={"vendor_id": vendor_id, "carrier": "camel"}).status_code == 422

    # Vendor with no items in this order -> 400.
    assert client.post(f"/orders/{order_id}/shipments", headers=fulfil,
                       json={"vendor_id": 99999, "carrier": "aramex"}).status_code == 400
