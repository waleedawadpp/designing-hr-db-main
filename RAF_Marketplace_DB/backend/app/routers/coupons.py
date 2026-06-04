"""Coupon management (marketing). Creating coupons requires `marketing.manage`."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, require_permission
from app.schemas import CouponCreateIn, CouponOut
from orm import AppUser, Coupon

router = APIRouter(prefix="/coupons", tags=["marketing"])


@router.post("", response_model=CouponOut, status_code=201)
def create_coupon(
    payload: CouponCreateIn,
    db: Session = Depends(get_db),
    _user: AppUser = Depends(require_permission("marketing.manage")),
):
    if payload.discount_type not in ("percent", "fixed"):
        raise HTTPException(status_code=422, detail="discount_type must be 'percent' or 'fixed'")
    if payload.discount_type == "percent" and payload.discount_value > 100:
        raise HTTPException(status_code=422, detail="Percentage discount cannot exceed 100")
    if db.scalar(select(Coupon).where(Coupon.code == payload.code)):
        raise HTTPException(status_code=409, detail="Coupon code already exists")

    coupon = Coupon(**payload.model_dump())
    db.add(coupon)
    db.commit()
    db.refresh(coupon)
    return coupon


@router.get("", response_model=list[CouponOut])
def list_coupons(
    _user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    active_only: bool = True,
):
    stmt = select(Coupon)
    if active_only:
        stmt = stmt.where(Coupon.is_active.is_(True))
    return db.scalars(stmt.order_by(Coupon.coupon_id.desc())).all()
