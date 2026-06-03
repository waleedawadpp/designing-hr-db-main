"""Vendor endpoints (public store listing + admin approval)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas import VendorOut
from orm import Vendor, VendorStatus

router = APIRouter(prefix="/vendors", tags=["vendors"])


@router.get("", response_model=list[VendorOut])
def list_vendors(db: Session = Depends(get_db), approved_only: bool = True):
    stmt = select(Vendor).where(Vendor.deleted_at.is_(None))
    if approved_only:
        stmt = stmt.where(Vendor.status == VendorStatus.approved)
    return db.scalars(stmt.order_by(Vendor.store_name_en)).all()


@router.get("/{slug}", response_model=VendorOut)
def get_vendor(slug: str, db: Session = Depends(get_db)):
    vendor = db.scalar(select(Vendor).where(Vendor.slug == slug, Vendor.deleted_at.is_(None)))
    if vendor is None:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor


@router.post("/{vendor_id}/approve", response_model=VendorOut)
def approve_vendor(vendor_id: int, db: Session = Depends(get_db)):
    """Admin action — mark a pending vendor as approved.

    NOTE: wire this to RBAC (`vendor.approve` permission) before production.
    """
    vendor = db.get(Vendor, vendor_id)
    if vendor is None:
        raise HTTPException(status_code=404, detail="Vendor not found")
    vendor.status = VendorStatus.approved
    db.commit()
    db.refresh(vendor)
    return vendor
