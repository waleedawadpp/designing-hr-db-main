"""Category & brand taxonomy: public browsing and admin CRUD."""

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


def test_category_crud_and_public_listing(client, db):
    admin = _admin(client, db, "tax-admin@example.com")

    r = client.post("/categories", headers=admin, json={
        "name_ar": "إلكترونيات", "name_en": "Electronics", "slug": "tax-electronics",
    })
    assert r.status_code == 201, r.text
    cid = r.json()["category_id"]
    assert r.json()["is_active"] is True

    # Child category referencing the parent.
    r = client.post("/categories", headers=admin, json={
        "name_ar": "هواتف", "name_en": "Phones", "slug": "tax-phones", "parent_id": cid,
    })
    assert r.status_code == 201 and r.json()["parent_id"] == cid

    # Duplicate slug -> 409; bad parent -> 400.
    assert client.post("/categories", headers=admin, json={
        "name_ar": "x", "name_en": "x", "slug": "tax-electronics"}).status_code == 409
    assert client.post("/categories", headers=admin, json={
        "name_ar": "x", "name_en": "x", "slug": "tax-x", "parent_id": 999999}).status_code == 400

    # Public listing needs no auth.
    slugs = [c["slug"] for c in client.get("/categories").json()]
    assert "tax-electronics" in slugs and "tax-phones" in slugs

    # Update + delete.
    assert client.put(f"/categories/{cid}", headers=admin, json={
        "name_ar": "أجهزة", "name_en": "Devices", "slug": "tax-devices"}).json()["name_en"] == "Devices"
    assert client.delete(f"/categories/{cid}", headers=admin).status_code == 204


def test_brand_crud(client, db):
    admin = _admin(client, db, "tax-brand-admin@example.com")
    r = client.post("/brands", headers=admin, json={
        "name_ar": "راف", "name_en": "RAF", "slug": "tax-raf"})
    assert r.status_code == 201
    bid = r.json()["brand_id"]

    assert client.post("/brands", headers=admin, json={
        "name_ar": "x", "name_en": "x", "slug": "tax-raf"}).status_code == 409

    assert "tax-raf" in [b["slug"] for b in client.get("/brands").json()]
    assert client.put(f"/brands/{bid}", headers=admin, json={
        "name_ar": "راف", "name_en": "RAF GCC", "slug": "tax-raf"}).json()["name_en"] == "RAF GCC"
    assert client.delete(f"/brands/{bid}", headers=admin).status_code == 204


def test_taxonomy_requires_permission(client):
    plain = _auth(client, "tax-plain@example.com")
    assert client.post("/categories", headers=plain, json={
        "name_ar": "x", "name_en": "x", "slug": "nope"}).status_code == 403
    assert client.post("/brands", headers=plain, json={
        "name_ar": "x", "name_en": "x", "slug": "nope"}).status_code == 403
    # Browsing stays public.
    assert client.get("/categories").status_code == 200
    assert client.get("/brands").status_code == 200
