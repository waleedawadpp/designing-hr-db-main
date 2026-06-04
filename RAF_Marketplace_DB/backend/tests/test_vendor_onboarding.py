"""Vendor onboarding: application, approval queue, approval grants access."""

from __future__ import annotations


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


def _apply(client, headers, slug):
    return client.post("/vendors/apply", headers=headers, json={
        "store_name_ar": "متجري", "store_name_en": "My Store", "slug": slug,
    })


def test_apply_creates_pending_vendor_with_wallet(client, db):
    h = _auth(client, "ob-applicant@example.com")
    r = _apply(client, h, "ob-store-1")
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "pending"

    from orm import VendorWallet
    assert db.get(VendorWallet, r.json()["vendor_id"]) is not None

    # Cannot apply twice while one is active.
    assert _apply(client, h, "ob-store-1b").status_code == 409
    # Apply needs auth.
    assert client.post("/vendors/apply", json={
        "store_name_ar": "x", "store_name_en": "x", "slug": "ob-x"}).status_code == 401
    # Duplicate slug (seeded store).
    other = _auth(client, "ob-other@example.com")
    assert _apply(client, other, "seed-store").status_code == 409


def test_approval_grants_owner_store_access(client, db):
    applicant = _auth(client, "ob-grant@example.com")
    vendor_id = _apply(client, applicant, "ob-grant-store").json()["vendor_id"]

    admin = _admin(client, db, "ob-admin@example.com")

    # Appears in the queue.
    queue = client.get("/vendors/admin/queue", headers=admin).json()
    assert any(v["vendor_id"] == vendor_id for v in queue)

    # Non-admin cannot approve.
    assert client.post(f"/vendors/{vendor_id}/approve", headers=applicant).status_code == 403

    r = client.post(f"/vendors/{vendor_id}/approve", headers=admin)
    assert r.status_code == 200 and r.json()["status"] == "approved"

    # The owner can now author products for their store.
    p = client.post("/products", headers=applicant, json={
        "vendor_id": vendor_id, "name_ar": "م", "name_en": "Owner Product",
        "slug": "ob-owner-product", "base_price": "3.000",
    })
    assert p.status_code == 201, p.text
    pid = p.json()["product_id"]
    assert client.post(f"/products/{pid}/variants", headers=applicant,
                       json={"sku": "OB-1", "price": "3.000", "quantity": 5}).status_code == 201


def test_reject_and_requires_pending(client, db):
    applicant = _auth(client, "ob-rej@example.com")
    vendor_id = _apply(client, applicant, "ob-reject-store").json()["vendor_id"]
    admin = _admin(client, db, "ob-rej-admin@example.com")

    assert client.post(f"/vendors/{vendor_id}/reject", headers=admin).json()["status"] == "rejected"
    # Re-reviewing a non-pending vendor is a conflict.
    assert client.post(f"/vendors/{vendor_id}/approve", headers=admin).status_code == 409
