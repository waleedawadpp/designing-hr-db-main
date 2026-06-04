"""AI layer endpoints: product-content generator, recommendations, assistant.

Every generation is recorded in `ai_job`; chats persist to `ai_chat_session` /
`ai_chat_message`. The actual text comes from a pluggable provider
(`app.services.ai`), deterministic by default.
"""

from __future__ import annotations

import datetime as dt
import re
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.schemas import (
    ChatIn, ChatOut, ForecastRow, ImageProcessIn, ImageProcessOut, ProductGenIn,
    ProductGenOut, RecommendationOut,
)
from app.services.ai import get_ai_provider
from app.services.access import assert_vendor_access
from orm import (
    AIChatMessage, AIChatSession, AIForecast, AIJob, AIJobStatus, AIJobType,
    AppUser, CustomerOrder, OrderItem, Product, ProductImage, ProductStatus,
    ProductVariant,
)

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/products/generate", response_model=ProductGenOut)
def generate_product_content(
    payload: ProductGenIn,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate bilingual title/description/tags/SEO from rough product input."""
    provider = get_ai_provider()
    job = AIJob(
        job_type=AIJobType.product_generator,
        status=AIJobStatus.running,
        requested_by=user.user_id,
        input=payload.model_dump(),
        model=getattr(provider, "model", None),
    )
    db.add(job)
    db.flush()

    try:
        content = provider.generate_product_content(
            name_hint=payload.name_hint, category=payload.category, details=payload.details,
        )
    except Exception as exc:  # noqa: BLE001 — record and surface the failure
        job.status = AIJobStatus.failed
        job.error = str(exc)
        job.completed_at = dt.datetime.now(dt.timezone.utc)
        db.commit()
        raise HTTPException(status_code=502, detail="AI generation failed") from exc

    job.status = AIJobStatus.succeeded
    job.output = content
    job.completed_at = dt.datetime.now(dt.timezone.utc)
    db.commit()
    return ProductGenOut(job_id=job.job_id, **content)


@router.get("/recommendations", response_model=list[RecommendationOut])
def recommendations(
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(10, ge=1, le=50),
):
    """Trending products by recent sales velocity; falls back to newest published."""
    sold = func.coalesce(func.sum(OrderItem.quantity), 0).label("units")
    rows = db.execute(
        select(Product, sold)
        .join(ProductVariant, ProductVariant.product_id == Product.product_id)
        .join(OrderItem, OrderItem.sku == ProductVariant.sku, isouter=True)
        .where(Product.status == ProductStatus.published, Product.deleted_at.is_(None))
        .group_by(Product.product_id)
        .order_by(sold.desc(), Product.created_at.desc())
        .limit(limit)
    ).all()

    out: list[RecommendationOut] = []
    for product, units in rows:
        kind = "trending" if units and units > 0 else "new"
        out.append(RecommendationOut(
            product_id=product.product_id, name_ar=product.name_ar,
            name_en=product.name_en, score=Decimal(int(units or 0)),
            recommendation_type=kind,
        ))
    return out


@router.post("/assistant/chat", response_model=ChatOut)
def assistant_chat(
    payload: ChatIn,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Shopping-assistant turn: persists the conversation and suggests products."""
    if payload.chat_id is not None:
        session = db.get(AIChatSession, payload.chat_id)
        if session is None or session.user_id != user.user_id:
            raise HTTPException(status_code=404, detail="Chat session not found")
    else:
        session = AIChatSession(user_id=user.user_id)
        db.add(session)
        db.flush()

    db.add(AIChatMessage(chat_id=session.chat_id, role="user", content=payload.message))

    # Keyword-based product retrieval to ground the reply.
    tokens = [w for w in re.findall(r"[A-Za-z0-9؀-ۿ]+", payload.message) if len(w) > 2]
    suggestions: list[dict] = []
    if tokens:
        conditions = []
        for tok in tokens:
            like = f"%{tok}%"
            conditions += [Product.name_ar.ilike(like), Product.name_en.ilike(like),
                           Product.description_en.ilike(like)]
        products = db.scalars(
            select(Product)
            .where(
                Product.status == ProductStatus.published,
                Product.deleted_at.is_(None),
                or_(*conditions),
            )
            .limit(5)
        ).all()
        suggestions = [{"product_id": p.product_id, "name_en": p.name_en} for p in products]

    history = [
        {"role": m.role, "content": m.content}
        for m in db.scalars(
            select(AIChatMessage)
            .where(AIChatMessage.chat_id == session.chat_id)
            .order_by(AIChatMessage.created_at)
        ).all()
    ]
    history.append({"role": "user", "content": payload.message})

    reply = get_ai_provider().assistant_reply(history, suggestions)
    db.add(AIChatMessage(chat_id=session.chat_id, role="assistant", content=reply))
    db.commit()

    return ChatOut(
        chat_id=session.chat_id, reply=reply,
        suggested_product_ids=[s["product_id"] for s in suggestions],
    )


@router.post("/images/process", response_model=ImageProcessOut)
def process_image(
    payload: ImageProcessIn,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Run an AI image operation (background removal/enhance/optimize/marketing)."""
    provider = get_ai_provider()
    job = AIJob(
        job_type=AIJobType.image_processing, status=AIJobStatus.running,
        requested_by=user.user_id, input=payload.model_dump(),
        model=getattr(provider, "model", None),
    )
    db.add(job)
    db.flush()
    try:
        result = provider.process_image(image_url=payload.image_url, operation=payload.operation)
    except ValueError as exc:
        job.status = AIJobStatus.failed
        job.error = str(exc)
        job.completed_at = dt.datetime.now(dt.timezone.utc)
        db.commit()
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    # Optionally write the result back onto a product image (with vendor access).
    if payload.product_image_id is not None:
        image = db.get(ProductImage, payload.product_image_id)
        if image is None:
            raise HTTPException(status_code=404, detail="Product image not found")
        product = db.get(Product, image.product_id)
        assert_vendor_access(db, user, product.vendor_id, admin_perm="product.moderate")
        image.url = result["processed_url"]
        image.is_ai_processed = True
        job.entity_type = "product_image"
        job.entity_id = str(image.image_id)

    job.status = AIJobStatus.succeeded
    job.output = result
    job.completed_at = dt.datetime.now(dt.timezone.utc)
    db.commit()
    return ImageProcessOut(job_id=job.job_id, operation=result["operation"],
                           processed_url=result["processed_url"])


@router.post("/forecast/products/{product_id}", response_model=list[ForecastRow])
def generate_forecast(
    product_id: int,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    days: int = Query(7, ge=1, le=90),
):
    """Naive demand forecast from the product's recent sales velocity."""
    product = db.get(Product, product_id)
    if product is None or product.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Product not found")
    assert_vendor_access(db, user, product.vendor_id, admin_perm="reports.platform")

    since = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=30)
    recent_units = db.scalar(
        select(func.coalesce(func.sum(OrderItem.quantity), 0))
        .join(ProductVariant, ProductVariant.sku == OrderItem.sku)
        .join(CustomerOrder, CustomerOrder.order_id == OrderItem.order_id)
        .where(ProductVariant.product_id == product_id, CustomerOrder.placed_at >= since)
    )
    daily = (Decimal(int(recent_units)) / Decimal(30)).quantize(Decimal("0.001"))

    today = dt.date.today()
    rows: list[AIForecast] = []
    for i in range(1, days + 1):
        f = AIForecast(
            vendor_id=product.vendor_id, product_id=product_id, metric="demand",
            horizon_date=today + dt.timedelta(days=i), predicted_value=daily,
            confidence=Decimal("0.60"),
        )
        db.add(f)
        rows.append(f)
    db.commit()
    for f in rows:
        db.refresh(f)
    return rows
