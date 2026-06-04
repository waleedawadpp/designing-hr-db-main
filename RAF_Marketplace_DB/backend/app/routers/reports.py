"""Reporting dashboards backed by the SQL analytics views.

Vendor-scoped reports are visible to the vendor's owner/staff or to platform
admins (``reports.platform``). Platform-wide financials require
``reports.platform``.
"""

from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, require_permission, user_permissions
from app.schemas import LowStockRow, MonthlyRevenueRow, VendorRevenueReport
from orm import AppUser, Vendor, VendorStaff

router = APIRouter(tags=["reports"])


def _assert_vendor_access(db: Session, user: AppUser, vendor_id: int) -> None:
    if "reports.platform" in user_permissions(db, user.user_id):
        return
    vendor = db.get(Vendor, vendor_id)
    if vendor is None:
        raise HTTPException(status_code=404, detail="Vendor not found")
    if vendor.owner_user_id == user.user_id:
        return
    if db.get(VendorStaff, {"vendor_id": vendor_id, "user_id": user.user_id}) is not None:
        return
    raise HTTPException(status_code=403, detail="Not authorized for this vendor's reports")


@router.get("/vendors/{vendor_id}/reports/revenue", response_model=VendorRevenueReport)
def vendor_revenue(
    vendor_id: int,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_vendor_access(db, user, vendor_id)
    row = db.execute(
        text("SELECT orders_count, units_sold, gross_sales, platform_commission, "
             "net_vendor_earnings FROM v_vendor_revenue WHERE vendor_id = :vid"),
        {"vid": vendor_id},
    ).mappings().first()
    if row is None:  # no paid sales yet
        return VendorRevenueReport(
            vendor_id=vendor_id, orders_count=0, units_sold=0,
            gross_sales=Decimal("0"), platform_commission=Decimal("0"),
            net_vendor_earnings=Decimal("0"),
        )
    return VendorRevenueReport(vendor_id=vendor_id, **row)


@router.get("/vendors/{vendor_id}/reports/low-stock", response_model=list[LowStockRow])
def vendor_low_stock(
    vendor_id: int,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_vendor_access(db, user, vendor_id)
    rows = db.execute(
        text("SELECT variant_id, product_id, name_en, sku, quantity, low_stock_threshold "
             "FROM v_low_stock WHERE vendor_id = :vid ORDER BY quantity"),
        {"vid": vendor_id},
    ).mappings().all()
    return [LowStockRow(**r) for r in rows]


@router.get("/reports/platform/monthly-revenue", response_model=list[MonthlyRevenueRow])
def platform_monthly_revenue(
    db: Session = Depends(get_db),
    _admin: AppUser = Depends(require_permission("reports.platform")),
):
    rows = db.execute(
        text("SELECT month, orders_count, gross_revenue, platform_commission "
             "FROM v_monthly_revenue ORDER BY month")
    ).mappings().all()
    return [MonthlyRevenueRow(**r) for r in rows]
