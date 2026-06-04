"""Coupon validation and discount calculation, shared by checkout."""

from __future__ import annotations

import datetime as dt
from decimal import ROUND_HALF_UP, Decimal

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from orm import Coupon

_CENTS = Decimal("0.001")


def apply_coupon(
    db: Session, code: str, subtotal: Decimal, vendor_subtotals: dict[int, Decimal]
) -> tuple[Decimal, Coupon]:
    """Validate ``code`` and return (discount, coupon). Raises HTTP 422 if invalid.

    A vendor-scoped coupon discounts only that vendor's portion of the order.
    """
    coupon = db.scalar(select(Coupon).where(Coupon.code == code))
    if coupon is None or not coupon.is_active:
        raise HTTPException(status_code=422, detail="Invalid coupon code")

    now = dt.datetime.now(dt.timezone.utc)
    if coupon.valid_from and now < coupon.valid_from:
        raise HTTPException(status_code=422, detail="Coupon is not yet valid")
    if coupon.valid_until and now > coupon.valid_until:
        raise HTTPException(status_code=422, detail="Coupon has expired")
    if coupon.usage_limit is not None and coupon.used_count >= coupon.usage_limit:
        raise HTTPException(status_code=422, detail="Coupon usage limit reached")

    eligible = subtotal if coupon.vendor_id is None else vendor_subtotals.get(coupon.vendor_id, Decimal("0"))
    if eligible <= 0:
        raise HTTPException(status_code=422, detail="Coupon does not apply to this order")
    if coupon.min_order_total is not None and subtotal < coupon.min_order_total:
        raise HTTPException(
            status_code=422,
            detail=f"Order must be at least {coupon.min_order_total} to use this coupon",
        )

    if coupon.discount_type == "percent":
        discount = (eligible * coupon.discount_value / Decimal(100)).quantize(
            _CENTS, rounding=ROUND_HALF_UP)
    else:  # fixed
        discount = coupon.discount_value
    discount = min(discount, eligible)  # never exceed the eligible amount
    return discount, coupon
