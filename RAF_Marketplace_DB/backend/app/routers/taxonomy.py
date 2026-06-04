"""Category & brand taxonomy: public browsing + admin CRUD (`catalog.manage`)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_permission
from app.schemas import BrandIn, BrandOut, CategoryIn, CategoryOut
from orm import AppUser, Brand, Category

router = APIRouter(tags=["taxonomy"])


# ---- categories ------------------------------------------------------------ #
@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db), active_only: bool = True):
    stmt = select(Category)
    if active_only:
        stmt = stmt.where(Category.is_active.is_(True))
    return db.scalars(stmt.order_by(Category.sort_order, Category.name_en)).all()


@router.post("/categories", response_model=CategoryOut, status_code=201)
def create_category(
    payload: CategoryIn,
    db: Session = Depends(get_db),
    _admin: AppUser = Depends(require_permission("catalog.manage")),
):
    if db.scalar(select(Category).where(Category.slug == payload.slug)):
        raise HTTPException(status_code=409, detail="Category slug already exists")
    if payload.parent_id is not None and db.get(Category, payload.parent_id) is None:
        raise HTTPException(status_code=400, detail="Parent category not found")
    category = Category(**payload.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.put("/categories/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: int,
    payload: CategoryIn,
    db: Session = Depends(get_db),
    _admin: AppUser = Depends(require_permission("catalog.manage")),
):
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    if payload.parent_id == category_id:
        raise HTTPException(status_code=400, detail="A category cannot be its own parent")
    dup = db.scalar(select(Category).where(Category.slug == payload.slug,
                                           Category.category_id != category_id))
    if dup is not None:
        raise HTTPException(status_code=409, detail="Category slug already exists")
    for field, value in payload.model_dump().items():
        setattr(category, field, value)
    db.commit()
    db.refresh(category)
    return category


@router.delete("/categories/{category_id}", status_code=204)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    _admin: AppUser = Depends(require_permission("catalog.manage")),
):
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    # FKs use ON DELETE SET NULL, so products/children are detached, not removed.
    db.delete(category)
    db.commit()


# ---- brands ---------------------------------------------------------------- #
@router.get("/brands", response_model=list[BrandOut])
def list_brands(db: Session = Depends(get_db)):
    return db.scalars(select(Brand).order_by(Brand.name_en)).all()


@router.post("/brands", response_model=BrandOut, status_code=201)
def create_brand(
    payload: BrandIn,
    db: Session = Depends(get_db),
    _admin: AppUser = Depends(require_permission("catalog.manage")),
):
    if db.scalar(select(Brand).where(Brand.slug == payload.slug)):
        raise HTTPException(status_code=409, detail="Brand slug already exists")
    brand = Brand(**payload.model_dump())
    db.add(brand)
    db.commit()
    db.refresh(brand)
    return brand


@router.put("/brands/{brand_id}", response_model=BrandOut)
def update_brand(
    brand_id: int,
    payload: BrandIn,
    db: Session = Depends(get_db),
    _admin: AppUser = Depends(require_permission("catalog.manage")),
):
    brand = db.get(Brand, brand_id)
    if brand is None:
        raise HTTPException(status_code=404, detail="Brand not found")
    dup = db.scalar(select(Brand).where(Brand.slug == payload.slug, Brand.brand_id != brand_id))
    if dup is not None:
        raise HTTPException(status_code=409, detail="Brand slug already exists")
    for field, value in payload.model_dump().items():
        setattr(brand, field, value)
    db.commit()
    db.refresh(brand)
    return brand


@router.delete("/brands/{brand_id}", status_code=204)
def delete_brand(
    brand_id: int,
    db: Session = Depends(get_db),
    _admin: AppUser = Depends(require_permission("catalog.manage")),
):
    brand = db.get(Brand, brand_id)
    if brand is None:
        raise HTTPException(status_code=404, detail="Brand not found")
    db.delete(brand)
    db.commit()
