"""Customer module: wishlist and address book."""

from __future__ import annotations

from tests.conftest import SEED_VARIANT_SKU


def _auth(client, email):
    client.post("/auth/register", json={
        "full_name": "Customer", "email": email, "password": "supersecret1",
    })
    token = client.post("/auth/login", data={
        "username": email, "password": "supersecret1",
    }).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _seed_product_id(db):
    from orm import Product, ProductVariant
    variant = db.query(ProductVariant).filter_by(sku=SEED_VARIANT_SKU).one()
    return db.get(Product, variant.product_id).product_id


# ---- wishlist -------------------------------------------------------------- #
def test_wishlist_add_idempotent_and_remove(client, db):
    h = _auth(client, "wish@example.com")
    pid = _seed_product_id(db)

    r = client.post("/wishlist/items", json={"product_id": pid}, headers=h)
    assert r.status_code == 201, r.text
    assert any(p["product_id"] == pid for p in r.json())

    # Adding again does not duplicate.
    r = client.post("/wishlist/items", json={"product_id": pid}, headers=h)
    assert sum(1 for p in r.json() if p["product_id"] == pid) == 1

    assert client.delete(f"/wishlist/items/{pid}", headers=h).status_code == 204
    assert all(p["product_id"] != pid for p in client.get("/wishlist", headers=h).json())


def test_wishlist_unknown_product_404(client):
    h = _auth(client, "wish404@example.com")
    assert client.post("/wishlist/items", json={"product_id": 999999}, headers=h).status_code == 404


def test_wishlist_requires_auth(client):
    assert client.get("/wishlist").status_code == 401


# ---- addresses ------------------------------------------------------------- #
def _addr(**over):
    base = {"recipient": "Ali", "phone": "+96890000000", "line1": "Street 1", "is_default": False}
    base.update(over)
    return base


def test_address_crud_and_single_default(client):
    h = _auth(client, "addr@example.com")

    a1 = client.post("/addresses", json=_addr(label="home", is_default=True), headers=h)
    assert a1.status_code == 201, a1.text
    id1 = a1.json()["address_id"]
    assert a1.json()["is_default"] is True

    # A second default flips the first one off.
    a2 = client.post("/addresses", json=_addr(label="work", is_default=True), headers=h)
    id2 = a2.json()["address_id"]
    listed = {a["address_id"]: a for a in client.get("/addresses", headers=h).json()}
    assert listed[id1]["is_default"] is False
    assert listed[id2]["is_default"] is True

    # Update.
    r = client.put(f"/addresses/{id1}", json=_addr(recipient="Sara", line1="New St"), headers=h)
    assert r.status_code == 200 and r.json()["recipient"] == "Sara"

    # Delete.
    assert client.delete(f"/addresses/{id2}", headers=h).status_code == 204
    assert [a["address_id"] for a in client.get("/addresses", headers=h).json()] == [id1]


def test_address_owner_scoped(client):
    a = _auth(client, "addr-a@example.com")
    addr_id = client.post("/addresses", json=_addr(), headers=a).json()["address_id"]

    b = _auth(client, "addr-b@example.com")
    assert client.put(f"/addresses/{addr_id}", json=_addr(), headers=b).status_code == 404
    assert client.delete(f"/addresses/{addr_id}", headers=b).status_code == 404
    assert client.get("/addresses", headers=b).json() == []
