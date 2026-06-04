"""Admin product moderation (requires `product.moderate`)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_permission
from app.schemas import ProductOut
from app.services.notifications import notify
from orm import AppUser, Product, ProductStatus

router = APIRouter(tags=["moderation"])


@router.get("/admin/products", response_model=list[ProductOut])
def moderation_queue(
    db: Session = Depends(get_db),
    _admin: AppUser = Depends(require_permission("product.moderate")),
    status: ProductStatus = ProductStatus.pending,
):
    return db.scalars(
        select(Product).where(Product.status == status, Product.deleted_at.is_(None))
        .order_by(Product.created_at)
    ).all()


def _pending_product(db: Session, product_id: int) -> Product:
    product = db.get(Product, product_id)
    if product is None or product.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.status != ProductStatus.pending:
        raise HTTPException(status_code=409, detail="Only pending products can be moderated")
    return product


@router.post("/products/{product_id}/approve", response_model=ProductOut)
def approve_product(
    product_id: int,
    db: Session = Depends(get_db),
    admin: AppUser = Depends(require_permission("product.moderate")),
):
    from orm import Vendor

    product = _pending_product(db, product_id)
    product.status = ProductStatus.published
    vendor = db.get(Vendor, product.vendor_id)
    if vendor is not None:
        notify(
            db, vendor.owner_user_id,
            title_ar="تمت الموافقة على منتجك", title_en="Your product was approved",
            body_ar=f"تم نشر المنتج {product.name_ar}.",
            body_en=f"Product {product.name_en} is now published.",
            payload={"product_id": product.product_id},
        )
    db.commit()
    db.refresh(product)
    return product


@router.post("/products/{product_id}/reject", response_model=ProductOut)
def reject_product(
    product_id: int,
    db: Session = Depends(get_db),
    admin: AppUser = Depends(require_permission("product.moderate")),
):
    from orm import Vendor

    product = _pending_product(db, product_id)
    product.status = ProductStatus.rejected
    vendor = db.get(Vendor, product.vendor_id)
    if vendor is not None:
        notify(
            db, vendor.owner_user_id,
            title_ar="تم رفض منتجك", title_en="Your product was rejected",
            body_ar=f"تم رفض المنتج {product.name_ar}. يرجى المراجعة.",
            body_en=f"Product {product.name_en} was rejected. Please review and resubmit.",
            payload={"product_id": product.product_id},
        )
    db.commit()
    db.refresh(product)
    return product
