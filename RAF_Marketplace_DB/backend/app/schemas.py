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


class VendorApplyIn(BaseModel):
    store_name_ar: str = Field(min_length=1, max_length=150)
    store_name_en: str = Field(min_length=1, max_length=150)
    slug: str = Field(min_length=1, max_length=160)
    description_ar: str | None = None
    description_en: str | None = None


class StaffAddIn(BaseModel):
    email: EmailStr
    role_key: str = Field(description="vendor_owner | vendor_staff")


class StaffOut(BaseModel):
    user_id: int
    full_name: str
    email: str
    role_key: str


class PayoutCreateIn(BaseModel):
    amount: Decimal = Field(gt=0)
    bank_iban: str | None = Field(None, max_length=34)


class PayoutOut(BaseModel):
    model_config = ORM
    payout_id: int
    vendor_id: int
    amount: Decimal
    currency: str
    status: str
    bank_iban: str | None = None
    requested_at: dt.datetime
    processed_at: dt.datetime | None = None


# ---- catalog --------------------------------------------------------------- #
class CategoryOut(BaseModel):
    model_config = ORM
    category_id: int
    name_ar: str
    name_en: str
    slug: str
    parent_id: int | None = None
    image_url: str | None = None
    sort_order: int
    is_active: bool


class CategoryIn(BaseModel):
    name_ar: str = Field(min_length=1, max_length=120)
    name_en: str = Field(min_length=1, max_length=120)
    slug: str = Field(min_length=1, max_length=140)
    parent_id: int | None = None
    image_url: str | None = None
    sort_order: int = 0
    is_active: bool = True


class BrandOut(BaseModel):
    model_config = ORM
    brand_id: int
    name_ar: str
    name_en: str
    slug: str
    logo_url: str | None = None


class BrandIn(BaseModel):
    name_ar: str = Field(min_length=1, max_length=120)
    name_en: str = Field(min_length=1, max_length=120)
    slug: str = Field(min_length=1, max_length=140)
    logo_url: str | None = None


class VariantOut(BaseModel):
    model_config = ORM
    variant_id: int
    sku: str
    barcode: str | None = None
    price: Decimal
    compare_at_price: Decimal | None = None
    is_active: bool


class ProductImageIn(BaseModel):
    url: str = Field(min_length=1)
    alt_text: str | None = Field(None, max_length=200)
    variant_id: int | None = None
    sort_order: int = 0


class ProductImageOut(BaseModel):
    model_config = ORM
    image_id: int
    product_id: int
    variant_id: int | None = None
    url: str
    alt_text: str | None = None
    sort_order: int
    is_ai_processed: bool


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
    images: list[ProductImageOut] = Field(default_factory=list)


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


class ProductUpdateIn(BaseModel):
    category_id: int | None = None
    brand_id: int | None = None
    name_ar: str | None = Field(None, min_length=1, max_length=200)
    name_en: str | None = Field(None, min_length=1, max_length=200)
    description_ar: str | None = None
    description_en: str | None = None
    base_price: Decimal | None = Field(None, ge=0)
    tags: list[str] | None = None
    seo_title: str | None = Field(None, max_length=200)
    seo_description: str | None = None


class ProductListResponse(Page):
    items: list[ProductOut]


# ---- variant / inventory management ---------------------------------------- #
class VariantCreateIn(BaseModel):
    sku: str = Field(min_length=1, max_length=60)
    price: Decimal = Field(ge=0)
    barcode: str | None = Field(None, max_length=60)
    compare_at_price: Decimal | None = None
    weight_grams: int | None = None
    quantity: int = Field(0, ge=0)
    low_stock_threshold: int = Field(5, ge=0)


class VariantUpdateIn(BaseModel):
    price: Decimal | None = Field(None, ge=0)
    compare_at_price: Decimal | None = None
    is_active: bool | None = None


class InventoryUpdateIn(BaseModel):
    quantity: int = Field(ge=0)
    low_stock_threshold: int | None = Field(None, ge=0)


class InventoryOut(BaseModel):
    model_config = ORM
    variant_id: int
    quantity: int
    reserved: int
    low_stock_threshold: int


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
    coupon_code: str | None = Field(None, description="Optional discount code")


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
    discount_total: Decimal
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


class ImageProcessIn(BaseModel):
    image_url: str = Field(min_length=1)
    operation: str = Field(description="background_removal | enhance | optimize | marketing")
    product_image_id: int | None = Field(None, description="Optionally update this product image")


class ImageProcessOut(BaseModel):
    job_id: int
    operation: str
    processed_url: str


class ForecastRow(BaseModel):
    model_config = ORM
    forecast_id: int
    product_id: int | None = None
    metric: str
    horizon_date: dt.date
    predicted_value: Decimal
    confidence: Decimal | None = None


# ---- shipping & tracking --------------------------------------------------- #
class ShipmentCreateIn(BaseModel):
    vendor_id: int
    carrier: str = Field(description="aramex | dhl | fedex | local")
    tracking_number: str | None = None


class ShipmentEventIn(BaseModel):
    status: str = Field(description="picked_up | in_transit | out_for_delivery | delivered | failed | returned")
    location: str | None = None
    note: str | None = None


class ShipmentEventOut(BaseModel):
    model_config = ORM
    event_id: int
    status: str
    location: str | None = None
    note: str | None = None
    occurred_at: dt.datetime


class ShipmentOut(BaseModel):
    model_config = ORM
    shipment_id: int
    order_id: int
    vendor_id: int
    carrier: str
    tracking_number: str | None = None
    status: str
    shipped_at: dt.datetime | None = None
    delivered_at: dt.datetime | None = None


class ShipmentDetail(ShipmentOut):
    events: list[ShipmentEventOut] = Field(default_factory=list)


# ---- returns & refunds ----------------------------------------------------- #
class ReturnCreateIn(BaseModel):
    order_item_id: int
    quantity: int = Field(ge=1)
    reason: str | None = None


class ReturnOut(BaseModel):
    model_config = ORM
    return_id: int
    order_item_id: int
    quantity: int
    reason: str | None = None
    status: str
    created_at: dt.datetime
    resolved_at: dt.datetime | None = None


class RefundOut(BaseModel):
    model_config = ORM
    refund_id: int
    payment_id: int
    return_id: int | None = None
    amount: Decimal
    reason: str | None = None


class ReturnResolved(ReturnOut):
    refund: RefundOut | None = None


# ---- reviews & ratings ----------------------------------------------------- #
class ReviewCreateIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    title: str | None = Field(None, max_length=150)
    body: str | None = None


class ReviewOut(BaseModel):
    model_config = ORM
    review_id: int
    product_id: int
    user_id: int
    rating: int
    title: str | None = None
    body: str | None = None
    is_verified_purchase: bool
    created_at: dt.datetime


class RatingSummary(BaseModel):
    average: Decimal
    count: int
    distribution: dict[int, int]  # stars (1-5) -> count


class ReviewListResponse(BaseModel):
    summary: RatingSummary
    items: list[ReviewOut]


# ---- wishlist -------------------------------------------------------------- #
class WishlistItemIn(BaseModel):
    product_id: int


class WishlistProductOut(BaseModel):
    model_config = ORM
    product_id: int
    name_ar: str
    name_en: str
    base_price: Decimal
    rating_avg: Decimal


# ---- addresses ------------------------------------------------------------- #
class AddressIn(BaseModel):
    label: str | None = Field(None, max_length=40)
    recipient: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=1, max_length=20)
    city_id: int | None = None
    line1: str = Field(min_length=1, max_length=200)
    line2: str | None = Field(None, max_length=200)
    postal_code: str | None = Field(None, max_length=20)
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    is_default: bool = False


class AddressOut(BaseModel):
    model_config = ORM
    address_id: int
    label: str | None = None
    recipient: str
    phone: str
    city_id: int | None = None
    line1: str
    line2: str | None = None
    postal_code: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    is_default: bool


# ---- marketing: coupons ---------------------------------------------------- #
class CouponCreateIn(BaseModel):
    code: str = Field(min_length=1, max_length=40)
    discount_type: str = Field(description="percent | fixed")
    discount_value: Decimal = Field(gt=0)
    vendor_id: int | None = None
    min_order_total: Decimal | None = None
    usage_limit: int | None = Field(None, ge=1)
    valid_from: dt.datetime | None = None
    valid_until: dt.datetime | None = None


class CouponOut(BaseModel):
    model_config = ORM
    coupon_id: int
    code: str
    discount_type: str
    discount_value: Decimal
    vendor_id: int | None = None
    min_order_total: Decimal | None = None
    usage_limit: int | None = None
    used_count: int
    is_active: bool


class CampaignGenIn(BaseModel):
    channel: str = Field(description="social | email | sms | ads")
    topic: str = Field(min_length=1, max_length=150)
    vendor_id: int | None = None


class CampaignCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    channel: str = Field(description="social | email | sms | ads")
    content_ar: str | None = None
    content_en: str | None = None
    vendor_id: int | None = None


class CampaignOut(BaseModel):
    model_config = ORM
    campaign_id: int
    vendor_id: int | None = None
    name: str
    channel: str
    content_ar: str | None = None
    content_en: str | None = None
    is_ai_generated: bool
    created_at: dt.datetime


# ---- reports (view-backed) ------------------------------------------------- #
class VendorRevenueReport(BaseModel):
    vendor_id: int
    orders_count: int
    units_sold: int
    gross_sales: Decimal
    platform_commission: Decimal
    net_vendor_earnings: Decimal


class LowStockRow(BaseModel):
    variant_id: int
    product_id: int
    name_en: str
    sku: str
    quantity: int
    low_stock_threshold: int


class MonthlyRevenueRow(BaseModel):
    month: dt.date
    orders_count: int
    gross_revenue: Decimal
    platform_commission: Decimal


# ---- notifications & devices ----------------------------------------------- #
class NotificationOut(BaseModel):
    model_config = ORM
    notification_id: int
    channel: str
    title_ar: str | None = None
    title_en: str | None = None
    body_ar: str | None = None
    body_en: str | None = None
    is_read: bool
    sent_at: dt.datetime


class UnreadCount(BaseModel):
    unread: int


class DeviceTokenIn(BaseModel):
    token: str = Field(min_length=1)
    platform: str = Field(description="android | ios | web")


class DeviceTokenOut(BaseModel):
    model_config = ORM
    token_id: int
    token: str
    platform: str
