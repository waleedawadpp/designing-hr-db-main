"""Shared vendor-access checks for vendor-scoped operations."""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.deps import user_permissions
from orm import AppUser, Vendor, VendorStaff


def assert_vendor_access(db: Session, user: AppUser, vendor_id: int, *, admin_perm: str) -> None:
    """Allow if the user holds ``admin_perm`` or owns/staffs the vendor."""
    if admin_perm in user_permissions(db, user.user_id):
        return
    vendor = db.get(Vendor, vendor_id)
    if vendor is None:
        raise HTTPException(status_code=404, detail="Vendor not found")
    if vendor.owner_user_id == user.user_id:
        return
    if db.get(VendorStaff, {"vendor_id": vendor_id, "user_id": user.user_id}) is not None:
        return
    raise HTTPException(status_code=403, detail="Not authorized for this vendor")
