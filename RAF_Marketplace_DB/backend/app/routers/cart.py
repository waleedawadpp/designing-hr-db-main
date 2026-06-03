"""Shopping cart endpoints (authenticated)."""

from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.schemas import CartItemIn, CartItemOut, CartOut
from orm import AppUser, Cart, CartItem, Product, ProductVariant

router = APIRouter(prefix="/cart", tags=["cart"])


def _get_or_create_cart(db: Session, user_id: int) -> Cart:
    cart = db.scalar(select(Cart).where(Cart.user_id == user_id))
    if cart is None:
        cart = Cart(user_id=user_id)
        db.add(cart)
        db.flush()
    return cart


def _serialize(db: Session, cart: Cart) -> CartOut:
    rows = db.execute(
        select(CartItem, ProductVariant, Product)
        .join(ProductVariant, ProductVariant.variant_id == CartItem.variant_id)
        .join(Product, Product.product_id == ProductVariant.product_id)
        .where(CartItem.cart_id == cart.cart_id)
    ).all()
    items: list[CartItemOut] = []
    subtotal = Decimal("0")
    for ci, variant, product in rows:
        line = variant.price * ci.quantity
        subtotal += line
        items.append(CartItemOut(
            variant_id=variant.variant_id, sku=variant.sku,
            name_ar=product.name_ar, name_en=product.name_en,
            unit_price=variant.price, quantity=ci.quantity, line_total=line,
        ))
    return CartOut(cart_id=cart.cart_id, items=items, subtotal=subtotal)


@router.get("", response_model=CartOut)
def view_cart(user: AppUser = Depends(get_current_user), db: Session = Depends(get_db)):
    cart = _get_or_create_cart(db, user.user_id)
    db.commit()
    return _serialize(db, cart)


@router.post("/items", response_model=CartOut)
def add_item(
    payload: CartItemIn,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    variant = db.get(ProductVariant, payload.variant_id)
    if variant is None or not variant.is_active:
        raise HTTPException(status_code=404, detail="Variant not found")

    cart = _get_or_create_cart(db, user.user_id)
    item = db.get(CartItem, {"cart_id": cart.cart_id, "variant_id": payload.variant_id})
    if item is None:
        db.add(CartItem(cart_id=cart.cart_id, variant_id=payload.variant_id,
                        quantity=payload.quantity))
    else:
        item.quantity += payload.quantity
    db.commit()
    return _serialize(db, cart)


@router.delete("/items/{variant_id}", response_model=CartOut)
def remove_item(
    variant_id: int,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cart = _get_or_create_cart(db, user.user_id)
    item = db.get(CartItem, {"cart_id": cart.cart_id, "variant_id": variant_id})
    if item is not None:
        db.delete(item)
    db.commit()
    return _serialize(db, cart)
