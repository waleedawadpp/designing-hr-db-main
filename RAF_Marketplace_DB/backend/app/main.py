"""RAF Marketplace API — FastAPI application entrypoint."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.middleware import ActivityLogMiddleware
from app.routers import (
    addresses, ai, audit, auth, campaigns, cart, coupons, health, moderation,
    notifications, orders, payouts, products, reports, returns, reviews,
    shipments, taxonomy, vendors, wishlist,
)

app = FastAPI(title=settings.api_title, version=settings.api_version)

_origins = ["*"] if settings.cors_origins.strip() == "*" else [
    o.strip() for o in settings.cors_origins.split(",") if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=settings.cors_origins.strip() != "*",
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(ActivityLogMiddleware)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(products.router)
app.include_router(vendors.router)
app.include_router(cart.router)
app.include_router(orders.router)
app.include_router(ai.router)
app.include_router(shipments.router)
app.include_router(returns.router)
app.include_router(reviews.router)
app.include_router(wishlist.router)
app.include_router(addresses.router)
app.include_router(reports.router)
app.include_router(coupons.router)
app.include_router(notifications.router)
app.include_router(moderation.router)
app.include_router(taxonomy.router)
app.include_router(payouts.router)
app.include_router(audit.router)
app.include_router(campaigns.router)


@app.get("/", tags=["system"])
def root() -> dict:
    return {
        "name": settings.api_title,
        "version": settings.api_version,
        "docs": "/docs",
    }
