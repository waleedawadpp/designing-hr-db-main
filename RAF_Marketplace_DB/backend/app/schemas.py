"""Pydantic v2 schemas (request/response contracts) for the RAF API."""

from __future__ import annotations

import datetime as dt
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

ORM = ConfigDict(from_attributes=True)


# ---- shared ---------------------------------------------------------------- #
class Page(BaseModel):
    """Generic pagination envelope."""
    total: int
    page: int
    page_size: int


# ---- vendors --------------------------------------------------------------- #
class VendorOut(BaseModel):
    model_config = ORM
    vendor_id: int
    store_name_ar: str
    store_name_en: str
    slug: str
    status: str
    commission_rate: Decimal
    logo_url: str | None = None


# ---- catalog --------------------------------------------------------------- #
class CategoryOut(BaseModel):
    model_config = ORM
    category_id: int
    name_ar: str
    name_en: str
    slug: str
    parent_id: int | None = None


class VariantOut(BaseModel):
    model_config = ORM
    variant_id: int
    sku: str
    barcode: str | None = None
    price: Decimal
    compare_at_price: Decimal | None = None
    is_active: bool


class ProductOut(BaseModel):
    model_config = ORM
    product_id: int
    vendor_id: int
    category_id: int | None = None
    brand_id: int | None = None
    name_ar: str
    name_en: str
    slug: str
    base_price: Decimal
    status: str
    rating_avg: Decimal
    rating_count: int
    tags: list[str] | None = None


class ProductDetail(ProductOut):
    description_ar: str | None = None
    description_en: str | None = None
    variants: list[VariantOut] = Field(default_factory=list)


class ProductCreate(BaseModel):
    vendor_id: int
    category_id: int | None = None
    brand_id: int | None = None
    name_ar: str = Field(min_length=1, max_length=200)
    name_en: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=220)
    description_ar: str | None = None
    description_en: str | None = None
    base_price: Decimal = Field(ge=0)
    tags: list[str] | None = None


class ProductListResponse(Page):
    items: list[ProductOut]


# ---- customers ------------------------------------------------------------- #
class CustomerCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    phone: str | None = None
    password: str = Field(min_length=8)
    preferred_lang: str = "ar"


class CustomerOut(BaseModel):
    model_config = ORM
    user_id: int
    full_name: str
    email: str
    preferred_lang: str
    status: str
    created_at: dt.datetime


# ---- auth ------------------------------------------------------------------ #
class RegisterIn(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    phone: str | None = None
    password: str = Field(min_length=8, max_length=128)
    preferred_lang: str = "ar"


class LoginIn(BaseModel):
    email: EmailStr
    password: str
    totp_code: str | None = Field(None, description="Required if 2FA is enabled")


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshIn(BaseModel):
    refresh_token: str


class MeOut(BaseModel):
    model_config = ORM
    user_id: int
    full_name: str
    email: str
    preferred_lang: str
    status: str
    twofa_enabled: bool


class TwoFASetupOut(BaseModel):
    secret: str
    otpauth_uri: str


class TwoFAVerifyIn(BaseModel):
    code: str = Field(min_length=6, max_length=8)


# ---- cart ------------------------------------------------------------------ #
class CartItemIn(BaseModel):
    variant_id: int
    quantity: int = Field(ge=1)


class CartItemOut(BaseModel):
    variant_id: int
    sku: str
    name_ar: str
    name_en: str
    unit_price: Decimal
    quantity: int
    line_total: Decimal


class CartOut(BaseModel):
    cart_id: int
    items: list[CartItemOut]
    subtotal: Decimal


# ---- orders & payments ----------------------------------------------------- #
class CheckoutIn(BaseModel):
    shipping_address_id: int | None = None
    gateway: str = Field(description="thawani | omannet | stripe | paypal | cod")


class OrderItemOut(BaseModel):
    model_config = ORM
    order_item_id: int
    vendor_id: int
    product_name: str
    sku: str
    unit_price: Decimal
    quantity: int
    line_total: Decimal
    commission_amount: Decimal


class PaymentOut(BaseModel):
    model_config = ORM
    payment_id: int
    gateway: str
    status: str
    amount: Decimal


class OrderOut(BaseModel):
    model_config = ORM
    order_id: int
    order_number: str
    status: str
    currency: str
    subtotal: Decimal
    grand_total: Decimal
    items: list[OrderItemOut] = Field(default_factory=list)


class OrderWithPayment(OrderOut):
    payment: PaymentOut | None = None


# ---- AI layer -------------------------------------------------------------- #
class ProductGenIn(BaseModel):
    name_hint: str | None = Field(None, description="Rough product name or keywords")
    category: str | None = None
    details: str | None = None


class ProductGenOut(BaseModel):
    job_id: int
    title_ar: str
    title_en: str
    description_ar: str
    description_en: str
    tags: list[str]
    seo_title: str
    seo_description: str


class RecommendationOut(BaseModel):
    product_id: int
    name_ar: str
    name_en: str
    score: Decimal
    recommendation_type: str


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    chat_id: int | None = Field(None, description="Continue an existing conversation")


class ChatOut(BaseModel):
    chat_id: int
    reply: str
    suggested_product_ids: list[int] = Field(default_factory=list)
