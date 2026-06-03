"""RAF Marketplace API — FastAPI application entrypoint."""

from __future__ import annotations

from fastapi import FastAPI

from app.config import settings
from app.routers import auth, cart, health, orders, products, vendors

app = FastAPI(title=settings.api_title, version=settings.api_version)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(products.router)
app.include_router(vendors.router)
app.include_router(cart.router)
app.include_router(orders.router)


@app.get("/", tags=["system"])
def root() -> dict:
    return {
        "name": settings.api_title,
        "version": settings.api_version,
        "docs": "/docs",
    }
