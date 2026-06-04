"""Product reviews & ratings.

Any authenticated user may leave one review per product; the review is flagged
`is_verified_purchase` when the user has a paid order containing the product.
Writing or deleting a review recomputes the product's cached `rating_avg` /
`rating_count`.
"""

from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.schemas import (
    RatingSummary, ReviewCreateIn, ReviewListResponse, ReviewOut,
)
from orm import (
    AppUser, CustomerOrder, OrderItem, Payment, PaymentStatus, Product,
    ProductStatus, ProductVariant, Review,
)

router = APIRouter(tags=["reviews"])


def _recalc_product_rating(db: Session, product_id: int) -> None:
    count, avg = db.execute(
        select(func.count(), func.coalesce(func.avg(Review.rating), 0))
        .where(Review.product_id == product_id)
    ).one()
    product = db.get(Product, product_id)
    if product is not None:
        product.rating_count = count
        product.rating_avg = Decimal(avg).quantize(Decimal("0.01"))


def _has_purchased(db: Session, user_id: int, product_id: int) -> bool:
    row = db.scalar(
        select(OrderItem.order_item_id)
        .join(ProductVariant, ProductVariant.variant_id == OrderItem.variant_id)
        .join(CustomerOrder, CustomerOrder.order_id == OrderItem.order_id)
        .join(Payment, Payment.order_id == CustomerOrder.order_id)
        .where(
            ProductVariant.product_id == product_id,
            CustomerOrder.user_id == user_id,
            Payment.status.in_((PaymentStatus.paid, PaymentStatus.partially_refunded)),
        )
        .limit(1)
    )
    return row is not None


@router.post("/products/{product_id}/reviews", response_model=ReviewOut, status_code=201)
def create_review(
    product_id: int,
    payload: ReviewCreateIn,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = db.get(Product, product_id)
    if product is None or product.deleted_at is not None or product.status != ProductStatus.published:
        raise HTTPException(status_code=404, detail="Product not found")

    if db.scalar(select(Review).where(Review.product_id == product_id, Review.user_id == user.user_id)):
        raise HTTPException(status_code=409, detail="You have already reviewed this product")

    review = Review(
        product_id=product_id, user_id=user.user_id, rating=payload.rating,
        title=payload.title, body=payload.body,
        is_verified_purchase=_has_purchased(db, user.user_id, product_id),
    )
    db.add(review)
    db.flush()
    _recalc_product_rating(db, product_id)
    db.commit()
    db.refresh(review)
    return review


@router.get("/products/{product_id}/reviews", response_model=ReviewListResponse)
def list_reviews(product_id: int, db: Session = Depends(get_db)):
    if db.get(Product, product_id) is None:
        raise HTTPException(status_code=404, detail="Product not found")

    reviews = db.scalars(
        select(Review).where(Review.product_id == product_id)
        .order_by(Review.created_at.desc())
    ).all()

    distribution = {star: 0 for star in range(1, 6)}
    for r in reviews:
        distribution[r.rating] += 1
    count = len(reviews)
    average = (
        Decimal(sum(r.rating for r in reviews) / count).quantize(Decimal("0.01"))
        if count else Decimal("0.00")
    )
    return ReviewListResponse(
        summary=RatingSummary(average=average, count=count, distribution=distribution),
        items=[ReviewOut.model_validate(r) for r in reviews],
    )


@router.delete("/reviews/{review_id}", status_code=204)
def delete_review(
    review_id: int,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    review = db.get(Review, review_id)
    if review is None:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.user_id != user.user_id:
        raise HTTPException(status_code=403, detail="You can only delete your own review")
    product_id = review.product_id
    db.delete(review)
    db.flush()
    _recalc_product_rating(db, product_id)
    db.commit()
