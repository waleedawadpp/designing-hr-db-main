"""Product catalog endpoints (storefront + vendor authoring)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.db import get_db
from app.deps import get_current_user, require_permission
from app.schemas import (
    InventoryOut, InventoryUpdateIn, ProductCreate, ProductDetail,
    ProductListResponse, ProductOut, VariantCreateIn, VariantOut, VariantUpdateIn,
)
from app.services.access import assert_vendor_access
from orm import AppUser, Inventory, Product, ProductStatus, ProductVariant

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=ProductListResponse)
def list_products(
    db: Session = Depends(get_db),
    category_id: int | None = None,
    vendor_id: int | None = None,
    q: str | None = Query(None, description="Search term (Arabic or English)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(settings.default_page_size, ge=1, le=settings.max_page_size),
):
    """Published product listing with optional category/vendor filters & search."""
    stmt = select(Product).where(
        Product.status == ProductStatus.published,
        Product.deleted_at.is_(None),
    )
    if category_id is not None:
        stmt = stmt.where(Product.category_id == category_id)
    if vendor_id is not None:
        stmt = stmt.where(Product.vendor_id == vendor_id)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Product.name_ar.ilike(like), Product.name_en.ilike(like)))

    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(
        stmt.order_by(Product.created_at.desc())
        .limit(page_size)
        .offset((page - 1) * page_size)
    ).all()

    return ProductListResponse(
        total=total or 0, page=page, page_size=page_size,
        items=[ProductOut.model_validate(r) for r in rows],
    )


@router.get("/{product_id}", response_model=ProductDetail)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.scalar(
        select(Product)
        .options(selectinload(Product.variants))
        .where(Product.product_id == product_id, Product.deleted_at.is_(None))
    )
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("", response_model=ProductDetail, status_code=201)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    _user: AppUser = Depends(require_permission("product.create")),
):
    product = Product(**payload.model_dump(), status=ProductStatus.draft)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def _product_for_vendor_edit(db: Session, product_id: int, user: AppUser) -> Product:
    product = db.get(Product, product_id)
    if product is None or product.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Product not found")
    assert_vendor_access(db, user, product.vendor_id, admin_perm="product.moderate")
    return product


@router.post("/{product_id}/variants", response_model=VariantOut, status_code=201)
def add_variant(
    product_id: int,
    payload: VariantCreateIn,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = _product_for_vendor_edit(db, product_id, user)
    if db.scalar(select(ProductVariant).where(ProductVariant.sku == payload.sku)):
        raise HTTPException(status_code=409, detail="SKU already exists")

    variant = ProductVariant(
        product_id=product.product_id, sku=payload.sku, price=payload.price,
        barcode=payload.barcode, compare_at_price=payload.compare_at_price,
        weight_grams=payload.weight_grams,
    )
    db.add(variant)
    db.flush()
    db.add(Inventory(
        variant_id=variant.variant_id, quantity=payload.quantity,
        low_stock_threshold=payload.low_stock_threshold,
    ))
    db.commit()
    db.refresh(variant)
    return variant


@router.put("/variants/{variant_id}", response_model=VariantOut)
def update_variant(
    variant_id: int,
    payload: VariantUpdateIn,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    variant = db.get(ProductVariant, variant_id)
    if variant is None:
        raise HTTPException(status_code=404, detail="Variant not found")
    _product_for_vendor_edit(db, variant.product_id, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(variant, field, value)
    db.commit()
    db.refresh(variant)
    return variant


@router.put("/variants/{variant_id}/inventory", response_model=InventoryOut)
def update_inventory(
    variant_id: int,
    payload: InventoryUpdateIn,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    variant = db.get(ProductVariant, variant_id)
    if variant is None:
        raise HTTPException(status_code=404, detail="Variant not found")
    _product_for_vendor_edit(db, variant.product_id, user)
    inv = db.get(Inventory, variant_id)
    if inv is None:
        inv = Inventory(variant_id=variant_id)
        db.add(inv)
    inv.quantity = payload.quantity
    if payload.low_stock_threshold is not None:
        inv.low_stock_threshold = payload.low_stock_threshold
    db.commit()
    db.refresh(inv)
    return inv


@router.post("/{product_id}/submit", response_model=ProductOut)
def submit_for_review(
    product_id: int,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Move a draft/rejected product to `pending` for admin moderation."""
    product = _product_for_vendor_edit(db, product_id, user)
    if product.status not in (ProductStatus.draft, ProductStatus.rejected):
        raise HTTPException(status_code=409, detail=f"Cannot submit a {product.status.value} product")
    if not db.scalar(select(ProductVariant).where(ProductVariant.product_id == product_id)):
        raise HTTPException(status_code=400, detail="Add at least one variant before submitting")
    product.status = ProductStatus.pending
    db.commit()
    db.refresh(product)
    return product
