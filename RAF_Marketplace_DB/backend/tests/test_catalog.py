"""Catalog management: variants, inventory, submit, and admin moderation."""

from __future__ import annotations


def _auth(client, email):
    client.post("/auth/register", json={
        "full_name": "U", "email": email, "password": "supersecret1",
    })
    token = client.post("/auth/login", data={
        "username": email, "password": "supersecret1",
    }).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _vendor_user(client, db, email):
    """A user who can author products for vendor 1 (role + vendor_staff link)."""
    from orm import AppUser, Role, UserRole, VendorStaff
    h = _auth(client, email)
    user = db.query(AppUser).filter_by(email=email).one()
    role = db.query(Role).filter_by(role_key="vendor_owner").one()
    db.add(UserRole(user_id=user.user_id, role_id=role.role_id))
    db.add(VendorStaff(vendor_id=1, user_id=user.user_id, role_id=role.role_id))
    db.commit()
    return h


def _admin(client, db, email):
    from orm import AppUser, Role, UserRole
    h = _auth(client, email)
    user = db.query(AppUser).filter_by(email=email).one()
    role = db.query(Role).filter_by(role_key="admin").one()
    db.add(UserRole(user_id=user.user_id, role_id=role.role_id))
    db.commit()
    return h


def _new_product(client, headers, slug):
    return client.post("/products", headers=headers, json={
        "vendor_id": 1, "name_ar": "منتج", "name_en": "Cat Product",
        "slug": slug, "base_price": "7.000",
    }).json()


def test_full_product_lifecycle_to_published(client, db):
    vendor = _vendor_user(client, db, "cat-vendor@example.com")
    admin = _admin(client, db, "cat-admin@example.com")

    product = _new_product(client, vendor, "cat-lifecycle")
    pid = product["product_id"]
    assert product["status"] == "draft"

    # Add a variant with stock.
    r = client.post(f"/products/{pid}/variants", headers=vendor,
                    json={"sku": "CAT-1", "price": "7.000", "quantity": 15})
    assert r.status_code == 201, r.text
    vid = r.json()["variant_id"]

    # Update price and stock.
    assert client.put(f"/products/variants/{vid}", headers=vendor,
                      json={"price": "6.500"}).json()["price"] == "6.500"
    inv = client.put(f"/products/variants/{vid}/inventory", headers=vendor,
                     json={"quantity": 30, "low_stock_threshold": 3}).json()
    assert inv["quantity"] == 30 and inv["low_stock_threshold"] == 3

    # Submit for review.
    assert client.post(f"/products/{pid}/submit", headers=vendor).json()["status"] == "pending"

    # Appears in the admin queue, then gets approved.
    queue = client.get("/admin/products?status=pending", headers=admin).json()
    assert any(p["product_id"] == pid for p in queue)
    assert client.post(f"/products/{pid}/approve", headers=admin).json()["status"] == "published"

    # Now publicly visible in listings.
    listed = client.get(f"/products?vendor_id=1").json()
    assert any(p["product_id"] == pid for p in listed["items"])


def test_submit_requires_a_variant(client, db):
    vendor = _vendor_user(client, db, "cat-novar@example.com")
    pid = _new_product(client, vendor, "cat-novariant")["product_id"]
    assert client.post(f"/products/{pid}/submit", headers=vendor).status_code == 400


def test_reject_flow_and_resubmit(client, db):
    vendor = _vendor_user(client, db, "cat-rej-vendor@example.com")
    admin = _admin(client, db, "cat-rej-admin@example.com")
    pid = _new_product(client, vendor, "cat-reject")["product_id"]
    client.post(f"/products/{pid}/variants", headers=vendor,
                json={"sku": "CAT-REJ", "price": "7.000", "quantity": 5})
    client.post(f"/products/{pid}/submit", headers=vendor)

    assert client.post(f"/products/{pid}/reject", headers=admin).json()["status"] == "rejected"
    # A rejected product can be resubmitted.
    assert client.post(f"/products/{pid}/submit", headers=vendor).json()["status"] == "pending"


def test_catalog_access_control(client, db):
    vendor = _vendor_user(client, db, "cat-acc-vendor@example.com")
    pid = _new_product(client, vendor, "cat-access")["product_id"]
    client.post(f"/products/{pid}/variants", headers=vendor,
                json={"sku": "CAT-ACC", "price": "7.000", "quantity": 5})
    client.post(f"/products/{pid}/submit", headers=vendor)

    # An outsider cannot add variants to this vendor's product.
    outsider = _auth(client, "cat-outsider@example.com")
    assert client.post(f"/products/{pid}/variants", headers=outsider,
                       json={"sku": "X", "price": "1.000"}).status_code in (403, 404)

    # A vendor without moderation rights cannot approve.
    assert client.post(f"/products/{pid}/approve", headers=vendor).status_code == 403


def test_product_images_crud(client, db):
    vendor = _vendor_user(client, db, "img-vendor@example.com")
    pid = _new_product(client, vendor, "img-product")["product_id"]

    r = client.post(f"/products/{pid}/images", headers=vendor,
                    json={"url": "https://cdn/x.jpg", "alt_text": "front", "sort_order": 1})
    assert r.status_code == 201, r.text
    img_id = r.json()["image_id"]

    # Public listing + product detail include the image.
    assert any(i["image_id"] == img_id for i in client.get(f"/products/{pid}/images").json())
    detail = client.get(f"/products/{pid}").json()
    assert any(i["image_id"] == img_id for i in detail["images"])

    # Outsiders cannot add or delete.
    outsider = _auth(client, "img-outsider@example.com")
    assert client.post(f"/products/{pid}/images", headers=outsider,
                       json={"url": "y"}).status_code in (403, 404)

    assert client.delete(f"/products/images/{img_id}", headers=vendor).status_code == 204
    assert client.get(f"/products/{pid}/images").json() == []


def test_product_update(client, db):
    vendor = _vendor_user(client, db, "upd-vendor@example.com")
    pid = _new_product(client, vendor, "upd-product")["product_id"]

    r = client.put(f"/products/{pid}", headers=vendor, json={
        "name_en": "Renamed", "base_price": "12.500", "tags": ["a", "b"]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name_en"] == "Renamed"
    assert body["base_price"] == "12.500"
    assert body["tags"] == ["a", "b"]

    # Outsider cannot edit.
    outsider = _auth(client, "upd-outsider@example.com")
    assert client.put(f"/products/{pid}", headers=outsider,
                      json={"name_en": "Hacked"}).status_code in (403, 404)
