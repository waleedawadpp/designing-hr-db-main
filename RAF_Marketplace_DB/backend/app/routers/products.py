"""Product catalog endpoints (storefront + vendor authoring)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.db import get_db
from app.deps import require_permission
from app.schemas import ProductCreate, ProductDetail, ProductListResponse, ProductOut
from orm import AppUser, Product, ProductStatus

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
