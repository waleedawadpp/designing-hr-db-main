"""Product catalog endpoints (storefront + vendor authoring)."""

from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.db import get_db
from app.deps import get_current_user, require_permission
from app.schemas import (
    InventoryOut, InventoryUpdateIn, ProductCreate, ProductDetail,
    ProductImageIn, ProductImageOut, ProductListResponse, ProductOut,
    VariantCreateIn, VariantOut, VariantUpdateIn,
)
from app.services.access import assert_vendor_access
from orm import AppUser, Inventory, Product, ProductImage, ProductStatus, ProductVariant

router = APIRouter(prefix="/products", tags=["products"])


_SORTS = {
    "newest": Product.created_at.desc(),
    "price_asc": Product.base_price.asc(),
    "price_desc": Product.base_price.desc(),
    "rating": Product.rating_avg.desc(),
}


@router.get("", response_model=ProductListResponse)
def list_products(
    db: Session = Depends(get_db),
    category_id: int | None = None,
    vendor_id: int | None = None,
    brand_id: int | None = None,
    q: str | None = Query(None, description="Search term (Arabic or English)"),
    min_price: Decimal | None = Query(None, ge=0),
    max_price: Decimal | None = Query(None, ge=0),
    in_stock: bool = Query(False, description="Only products with available stock"),
    sort: str = Query("newest", pattern="^(newest|price_asc|price_desc|rating)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(settings.default_page_size, ge=1, le=settings.max_page_size),
):
    """Published product listing with filtering, search, sorting and pagination."""
    stmt = select(Product).where(
        Product.status == ProductStatus.published,
        Product.deleted_at.is_(None),
    )
    if category_id is not None:
        stmt = stmt.where(Product.category_id == category_id)
    if vendor_id is not None:
        stmt = stmt.where(Product.vendor_id == vendor_id)
    if brand_id is not None:
        stmt = stmt.where(Product.brand_id == brand_id)
    if min_price is not None:
        stmt = stmt.where(Product.base_price >= min_price)
    if max_price is not None:
        stmt = stmt.where(Product.base_price <= max_price)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Product.name_ar.ilike(like), Product.name_en.ilike(like)))
    if in_stock:
        available = (
            select(ProductVariant.variant_id)
            .join(Inventory, Inventory.variant_id == ProductVariant.variant_id)
            .where(
                ProductVariant.product_id == Product.product_id,
                Inventory.quantity - Inventory.reserved > 0,
            )
            .exists()
        )
        stmt = stmt.where(available)

    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(
        stmt.order_by(_SORTS[sort])
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
        .options(selectinload(Product.variants), selectinload(Product.images))
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


@router.get("/{product_id}/images", response_model=list[ProductImageOut])
def list_product_images(product_id: int, db: Session = Depends(get_db)):
    if db.get(Product, product_id) is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return db.scalars(
        select(ProductImage).where(ProductImage.product_id == product_id)
        .order_by(ProductImage.sort_order)
    ).all()


@router.post("/{product_id}/images", response_model=ProductImageOut, status_code=201)
def add_product_image(
    product_id: int,
    payload: ProductImageIn,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _product_for_vendor_edit(db, product_id, user)
    if payload.variant_id is not None:
        variant = db.get(ProductVariant, payload.variant_id)
        if variant is None or variant.product_id != product_id:
            raise HTTPException(status_code=400, detail="Variant does not belong to this product")
    image = ProductImage(product_id=product_id, **payload.model_dump())
    db.add(image)
    db.commit()
    db.refresh(image)
    return image


@router.delete("/images/{image_id}", status_code=204)
def delete_product_image(
    image_id: int,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    image = db.get(ProductImage, image_id)
    if image is None:
        raise HTTPException(status_code=404, detail="Image not found")
    _product_for_vendor_edit(db, image.product_id, user)
    db.delete(image)
    db.commit()
