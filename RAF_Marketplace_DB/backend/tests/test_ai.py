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
