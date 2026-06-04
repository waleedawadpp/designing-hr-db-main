"""Product reviews: verified purchase flag, rating recalculation, summary, delete."""

from __future__ import annotations

from decimal import Decimal


def _auth(client, email):
    client.post("/auth/register", json={
        "full_name": "Reviewer", "email": email, "password": "supersecret1",
    })
    token = client.post("/auth/login", data={
        "username": email, "password": "supersecret1",
    }).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _make_product(db, slug):
    """Fresh published product (on the seeded vendor) so ratings are isolated."""
    from orm import Inventory, Product, ProductStatus, ProductVariant
    p = Product(vendor_id=1, name_ar="منتج", name_en="Review Product",
                slug=slug, base_price="5.000", status=ProductStatus.published)
    db.add(p)
    db.flush()
    v = ProductVariant(product_id=p.product_id, sku=f"{slug}-sku", price="5.000")
    db.add(v)
    db.flush()
    db.add(Inventory(variant_id=v.variant_id, quantity=10))
    db.commit()
    return p.product_id, v.variant_id


def _simulate_paid_purchase(db, email, variant_id):
    from orm import (
        AppUser, CustomerOrder, OrderItem, OrderStatus, Payment,
        PaymentGateway, PaymentStatus, ProductVariant,
    )
    user = db.query(AppUser).filter_by(email=email).one()
    v = db.get(ProductVariant, variant_id)
    order = CustomerOrder(order_number=f"RV-{variant_id}-{user.user_id}", user_id=user.user_id,
                          status=OrderStatus.confirmed, subtotal="5.000", grand_total="5.000")
    db.add(order)
    db.flush()
    db.add(OrderItem(order_id=order.order_id, variant_id=variant_id, vendor_id=1,
                     product_name="Review Product", sku=v.sku, unit_price="5.000",
                     quantity=1, line_total="5.000", commission_rate="10.00",
                     commission_amount="0.500"))
    db.add(Payment(order_id=order.order_id, gateway=PaymentGateway.cod,
                   status=PaymentStatus.paid, amount="5.000"))
    db.commit()


def _rating(client, headers, product_id):
    p = client.get(f"/products/{product_id}", headers=headers).json()
    return Decimal(str(p["rating_avg"])), p["rating_count"]


def test_verified_review_updates_rating(client, db):
    product_id, variant_id = _make_product(db, "rev-verified")
    h = _auth(client, "verified@example.com")
    _simulate_paid_purchase(db, "verified@example.com", variant_id)

    r = client.post(f"/products/{product_id}/reviews", headers=h,
                    json={"rating": 5, "title": "Great", "body": "Loved it"})
    assert r.status_code == 201, r.text
    assert r.json()["is_verified_purchase"] is True

    avg, count = _rating(client, h, product_id)
    assert avg == Decimal("5.00") and count == 1


def test_unverified_and_duplicate_review(client, db):
    product_id, _ = _make_product(db, "rev-unverified")
    h = _auth(client, "unverified@example.com")

    r = client.post(f"/products/{product_id}/reviews", headers=h, json={"rating": 3})
    assert r.status_code == 201
    assert r.json()["is_verified_purchase"] is False

    # One review per user per product.
    r = client.post(f"/products/{product_id}/reviews", headers=h, json={"rating": 4})
    assert r.status_code == 409

    avg, count = _rating(client, h, product_id)
    assert avg == Decimal("3.00") and count == 1


def test_average_summary_and_delete(client, db):
    product_id, _ = _make_product(db, "rev-avg")
    a = _auth(client, "rev-a@example.com")
    b = _auth(client, "rev-b@example.com")

    review_a = client.post(f"/products/{product_id}/reviews", headers=a,
                           json={"rating": 4}).json()
    client.post(f"/products/{product_id}/reviews", headers=b, json={"rating": 2})

    body = client.get(f"/products/{product_id}/reviews").json()
    assert body["summary"]["count"] == 2
    assert Decimal(str(body["summary"]["average"])) == Decimal("3.00")
    assert body["summary"]["distribution"]["4"] == 1
    assert body["summary"]["distribution"]["2"] == 1

    # Only the author may delete.
    assert client.delete(f"/reviews/{review_a['review_id']}", headers=b).status_code == 403
    assert client.delete(f"/reviews/{review_a['review_id']}", headers=a).status_code == 204

    # Rating recalculated after deletion.
    avg, count = _rating(client, a, product_id)
    assert avg == Decimal("2.00") and count == 1


def test_review_validation_and_auth(client, db):
    product_id, _ = _make_product(db, "rev-val")
    h = _auth(client, "rev-val@example.com")

    # Out-of-range rating -> 422.
    assert client.post(f"/products/{product_id}/reviews", headers=h,
                       json={"rating": 6}).status_code == 422
    # Unauthenticated -> 401.
    assert client.post(f"/products/{product_id}/reviews", json={"rating": 5}).status_code == 401
    # Unknown product -> 404.
    assert client.post("/products/999999/reviews", headers=h,
                       json={"rating": 5}).status_code == 404
