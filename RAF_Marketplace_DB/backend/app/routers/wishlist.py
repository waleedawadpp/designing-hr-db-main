"""Customer wishlist (authenticated)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.schemas import WishlistItemIn, WishlistProductOut
from orm import AppUser, Product, WishlistItem

router = APIRouter(prefix="/wishlist", tags=["wishlist"])


@router.get("", response_model=list[WishlistProductOut])
def list_wishlist(user: AppUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(Product)
        .join(WishlistItem, WishlistItem.product_id == Product.product_id)
        .where(WishlistItem.user_id == user.user_id, Product.deleted_at.is_(None))
        .order_by(WishlistItem.added_at.desc())
    ).all()


@router.post("/items", response_model=list[WishlistProductOut], status_code=201)
def add_item(
    payload: WishlistItemIn,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if db.get(Product, payload.product_id) is None:
        raise HTTPException(status_code=404, detail="Product not found")
    # Idempotent: ignore if already saved.
    exists = db.get(WishlistItem, {"user_id": user.user_id, "product_id": payload.product_id})
    if exists is None:
        db.add(WishlistItem(user_id=user.user_id, product_id=payload.product_id))
        db.commit()
    return list_wishlist(user, db)


@router.delete("/items/{product_id}", status_code=204)
def remove_item(
    product_id: int,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = db.get(WishlistItem, {"user_id": user.user_id, "product_id": product_id})
    if item is not None:
        db.delete(item)
        db.commit()
