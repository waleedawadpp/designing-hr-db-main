"""Notification inbox, event emission, and push-device registration."""

from __future__ import annotations

from tests.conftest import SEED_VARIANT_SKU


def _auth(client, email):
    client.post("/auth/register", json={
        "full_name": "U", "email": email, "password": "supersecret1",
    })
    token = client.post("/auth/login", data={
        "username": email, "password": "supersecret1",
    }).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_order_confirmation_emits_notification(client, db):
    h = _auth(client, "notif-buyer@example.com")
    from orm import ProductVariant
    vid = db.query(ProductVariant).filter_by(sku=SEED_VARIANT_SKU).one().variant_id
    client.post("/cart/items", json={"variant_id": vid, "quantity": 1}, headers=h)
    order = client.post("/orders/checkout", json={"gateway": "cod"}, headers=h).json()

    # No confirmation notification yet.
    assert client.get("/notifications/unread-count", headers=h).json()["unread"] == 0

    client.post(f"/orders/{order['order_id']}/pay/confirm", headers=h)

    notifs = client.get("/notifications", headers=h).json()
    assert len(notifs) == 1
    assert notifs[0]["title_en"] == "Your order is confirmed"
    assert notifs[0]["is_read"] is False
    assert client.get("/notifications/unread-count", headers=h).json()["unread"] == 1


def test_mark_read_and_read_all(client, db):
    h = _auth(client, "notif-read@example.com")
    from orm import ProductVariant
    vid = db.query(ProductVariant).filter_by(sku=SEED_VARIANT_SKU).one().variant_id
    # Generate two notifications via two confirmed orders.
    for _ in range(2):
        client.post("/cart/items", json={"variant_id": vid, "quantity": 1}, headers=h)
        oid = client.post("/orders/checkout", json={"gateway": "cod"}, headers=h).json()["order_id"]
        client.post(f"/orders/{oid}/pay/confirm", headers=h)

    notifs = client.get("/notifications", headers=h).json()
    assert len(notifs) == 2

    # Mark one read.
    r = client.post(f"/notifications/{notifs[0]['notification_id']}/read", headers=h)
    assert r.status_code == 200 and r.json()["is_read"] is True
    assert client.get("/notifications/unread-count", headers=h).json()["unread"] == 1

    # Mark all read.
    assert client.post("/notifications/read-all", headers=h).json()["unread"] == 0
    assert client.get("/notifications/unread-count", headers=h).json()["unread"] == 0


def test_notifications_owner_scoped_and_auth(client):
    a = _auth(client, "notif-a@example.com")
    b = _auth(client, "notif-b@example.com")
    # Marking a non-existent / other user's notification.
    assert client.post("/notifications/999999/read", headers=a).status_code == 404
    assert client.get("/notifications").status_code == 401
    assert client.get("/notifications", headers=b).json() == []


def test_device_registration_idempotent_and_delete(client):
    h = _auth(client, "notif-dev@example.com")

    r = client.post("/devices", json={"token": "tok-123", "platform": "ios"}, headers=h)
    assert r.status_code == 201, r.text
    first_id = r.json()["token_id"]

    # Re-registering the same token does not duplicate it.
    r = client.post("/devices", json={"token": "tok-123", "platform": "android"}, headers=h)
    assert r.json()["token_id"] == first_id and r.json()["platform"] == "android"

    # Invalid platform rejected.
    assert client.post("/devices", json={"token": "x", "platform": "blackberry"},
                       headers=h).status_code == 422

    assert client.delete("/devices/tok-123", headers=h).status_code == 204
