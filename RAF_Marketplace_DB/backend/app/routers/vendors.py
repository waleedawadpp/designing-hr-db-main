"""Vendor endpoints: public listing, onboarding application, and admin approval."""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, require_permission
from app.schemas import VendorApplyIn, VendorOut
from app.services.notifications import notify
from orm import (
    AppUser, Role, UserRole, Vendor, VendorStaff, VendorStatus, VendorWallet,
)

router = APIRouter(prefix="/vendors", tags=["vendors"])

_ACTIVE_VENDOR = (VendorStatus.pending, VendorStatus.approved)


@router.get("", response_model=list[VendorOut])
def list_vendors(db: Session = Depends(get_db), approved_only: bool = True):
    stmt = select(Vendor).where(Vendor.deleted_at.is_(None))
    if approved_only:
        stmt = stmt.where(Vendor.status == VendorStatus.approved)
    return db.scalars(stmt.order_by(Vendor.store_name_en)).all()


@router.post("/apply", response_model=VendorOut, status_code=201)
def apply_to_become_vendor(
    payload: VendorApplyIn,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.scalar(
        select(Vendor).where(
            Vendor.owner_user_id == user.user_id,
            Vendor.status.in_(_ACTIVE_VENDOR),
            Vendor.deleted_at.is_(None),
        )
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="You already have a vendor application/store")
    if db.scalar(select(Vendor).where(Vendor.slug == payload.slug)):
        raise HTTPException(status_code=409, detail="Store slug already exists")

    vendor = Vendor(
        owner_user_id=user.user_id, status=VendorStatus.pending, **payload.model_dump(),
    )
    db.add(vendor)
    db.flush()
    db.add(VendorWallet(vendor_id=vendor.vendor_id))
    db.commit()
    db.refresh(vendor)
    return vendor


@router.get("/admin/queue", response_model=list[VendorOut])
def approval_queue(
    db: Session = Depends(get_db),
    _admin: AppUser = Depends(require_permission("vendor.approve")),
    status: VendorStatus = VendorStatus.pending,
):
    return db.scalars(
        select(Vendor).where(Vendor.status == status, Vendor.deleted_at.is_(None))
        .order_by(Vendor.created_at)
    ).all()


@router.get("/{slug}", response_model=VendorOut)
def get_vendor(slug: str, db: Session = Depends(get_db)):
    vendor = db.scalar(select(Vendor).where(Vendor.slug == slug, Vendor.deleted_at.is_(None)))
    if vendor is None:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor


def _pending_vendor(db: Session, vendor_id: int) -> Vendor:
    vendor = db.get(Vendor, vendor_id)
    if vendor is None or vendor.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Vendor not found")
    if vendor.status != VendorStatus.pending:
        raise HTTPException(status_code=409, detail="Only pending vendors can be reviewed")
    return vendor


@router.post("/{vendor_id}/approve", response_model=VendorOut)
def approve_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    admin: AppUser = Depends(require_permission("vendor.approve")),
):
    """Approve a pending vendor and grant the owner store-management access."""
    vendor = _pending_vendor(db, vendor_id)
    vendor.status = VendorStatus.approved
    vendor.approved_by = admin.user_id
    vendor.approved_at = dt.datetime.now(dt.timezone.utc)

    if db.get(VendorWallet, vendor_id) is None:
        db.add(VendorWallet(vendor_id=vendor_id))

    role = db.scalar(select(Role).where(Role.role_key == "vendor_owner"))
    if role is not None:
        if db.get(UserRole, {"user_id": vendor.owner_user_id, "role_id": role.role_id}) is None:
            db.add(UserRole(user_id=vendor.owner_user_id, role_id=role.role_id))
        if db.get(VendorStaff, {"vendor_id": vendor_id, "user_id": vendor.owner_user_id}) is None:
            db.add(VendorStaff(vendor_id=vendor_id, user_id=vendor.owner_user_id, role_id=role.role_id))

    notify(
        db, vendor.owner_user_id,
        title_ar="تمت الموافقة على متجرك", title_en="Your store was approved",
        body_ar=f"تمت الموافقة على متجر {vendor.store_name_ar}.",
        body_en=f"Your store {vendor.store_name_en} has been approved.",
        payload={"vendor_id": vendor_id},
    )
    db.commit()
    db.refresh(vendor)
    return vendor


@router.post("/{vendor_id}/reject", response_model=VendorOut)
def reject_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    _admin: AppUser = Depends(require_permission("vendor.approve")),
):
    vendor = _pending_vendor(db, vendor_id)
    vendor.status = VendorStatus.rejected
    notify(
        db, vendor.owner_user_id,
        title_ar="تم رفض طلب متجرك", title_en="Your store application was rejected",
        body_ar=f"تم رفض طلب متجر {vendor.store_name_ar}.",
        body_en=f"Your store application {vendor.store_name_en} was rejected.",
        payload={"vendor_id": vendor_id},
    )
    db.commit()
    db.refresh(vendor)
    return vendor
