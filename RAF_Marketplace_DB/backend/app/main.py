"""RAF Marketplace API — FastAPI application entrypoint."""

from __future__ import annotations

from fastapi import FastAPI

from app.config import settings
from app.routers import (
    addresses, ai, auth, cart, health, orders, products, reports, returns,
    reviews, shipments, vendors, wishlist,
)

app = FastAPI(title=settings.api_title, version=settings.api_version)

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


@app.get("/", tags=["system"])
def root() -> dict:
    return {
        "name": settings.api_title,
        "version": settings.api_version,
        "docs": "/docs",
    }
