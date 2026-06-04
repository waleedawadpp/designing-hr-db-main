"""AI layer: product generator, recommendations, and assistant chat."""

from __future__ import annotations


def _auth(client, email):
    client.post("/auth/register", json={
        "full_name": "AI User", "email": email, "password": "supersecret1",
    })
    token = client.post("/auth/login", data={
        "username": email, "password": "supersecret1",
    }).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_product_generator_returns_bilingual_and_persists_job(client, db):
    from orm import AIJob, AIJobStatus

    h = _auth(client, "gen@example.com")
    r = client.post("/ai/products/generate", headers=h, json={
        "name_hint": "wireless headphones", "category": "Electronics",
        "details": "noise cancelling",
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["title_en"]                      # English title present
    assert any("؀" <= c <= "ۿ" for c in body["title_ar"])  # Arabic chars present
    assert "wireless" in body["tags"]
    assert body["seo_title"].endswith("RAF Marketplace")

    job = db.get(AIJob, body["job_id"])
    db.refresh(job)
    assert job.status == AIJobStatus.succeeded
    assert job.job_type.value == "product_generator"
    assert job.output["title_en"] == body["title_en"]


def test_generator_requires_auth(client):
    assert client.post("/ai/products/generate", json={"name_hint": "x"}).status_code == 401


def test_recommendations_returns_published_products(client):
    h = _auth(client, "rec@example.com")
    r = client.get("/ai/recommendations", headers=h)
    assert r.status_code == 200, r.text
    items = r.json()
    assert len(items) >= 1
    assert {"product_id", "name_ar", "name_en", "score", "recommendation_type"} <= items[0].keys()


def test_assistant_chat_persists_and_continues(client, db):
    from orm import AIChatMessage

    h = _auth(client, "chat@example.com")
    r = client.post("/ai/assistant/chat", headers=h, json={"message": "I want a Seed Product"})
    assert r.status_code == 200, r.text
    first = r.json()
    assert first["reply"]
    assert first["suggested_product_ids"]   # the seeded product matches "Seed Product"
    chat_id = first["chat_id"]

    # Continue the same conversation.
    r = client.post("/ai/assistant/chat", headers=h,
                    json={"message": "what about the price?", "chat_id": chat_id})
    assert r.status_code == 200
    assert r.json()["chat_id"] == chat_id

    # 2 user + 2 assistant messages persisted.
    count = db.query(AIChatMessage).filter_by(chat_id=chat_id).count()
    assert count == 4


def test_chat_session_scoped_to_owner(client):
    a = _auth(client, "chat-a@example.com")
    chat_id = client.post("/ai/assistant/chat", headers=a, json={"message": "hi"}).json()["chat_id"]

    b = _auth(client, "chat-b@example.com")
    r = client.post("/ai/assistant/chat", headers=b,
                    json={"message": "hijack", "chat_id": chat_id})
    assert r.status_code == 404


def test_image_processing_records_job(client, db):
    from orm import AIJob, AIJobStatus

    h = _auth(client, "img@example.com")
    r = client.post("/ai/images/process", headers=h, json={
        "image_url": "https://cdn.example.com/p.jpg", "operation": "background_removal",
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["operation"] == "background_removal"
    assert "ai=background_removal" in body["processed_url"]
    job = db.get(AIJob, body["job_id"])
    db.refresh(job)
    assert job.status == AIJobStatus.succeeded and job.job_type.value == "image_processing"


def test_image_processing_invalid_operation(client):
    h = _auth(client, "img-bad@example.com")
    assert client.post("/ai/images/process", headers=h, json={
        "image_url": "x", "operation": "teleport"}).status_code == 422


def test_forecast_generation_and_access(client, db):
    # A fresh vendor-linked user can forecast their product; outsiders cannot.
    from orm import (
        AppUser, Inventory, Product, ProductStatus, ProductVariant, Role, VendorStaff,
    )
    h = _auth(client, "fc-vendor@example.com")
    user = db.query(AppUser).filter_by(email="fc-vendor@example.com").one()
    role = db.query(Role).filter_by(role_key="vendor_owner").one()
    db.add(VendorStaff(vendor_id=1, user_id=user.user_id, role_id=role.role_id))
    p = Product(vendor_id=1, name_ar="م", name_en="FC", slug="fc-product",
                base_price="9.000", status=ProductStatus.published)
    db.add(p)
    db.flush()
    v = ProductVariant(product_id=p.product_id, sku="FC-1", price="9.000")
    db.add(v)
    db.flush()
    db.add(Inventory(variant_id=v.variant_id, quantity=10))
    db.commit()

    r = client.post(f"/ai/forecast/products/{p.product_id}?days=5", headers=h)
    assert r.status_code == 200, r.text
    rows = r.json()
    assert len(rows) == 5
    assert all(row["metric"] == "demand" for row in rows)

    outsider = _auth(client, "fc-outsider@example.com")
    assert client.post(f"/ai/forecast/products/{p.product_id}", headers=outsider).status_code == 403
