"""RAF Marketplace — SQLAlchemy 2.0 ORM models.

A typed object-relational mapping that mirrors ``schema.sql`` one-to-one,
ready to plug into a FastAPI backend (the spec's Python/FastAPI/PostgreSQL
stack).

Usage
-----
    from sqlalchemy import create_engine
    from raf_orm import Base

    engine = create_engine("postgresql+psycopg2://user:pass@host/raf_marketplace")
    Base.metadata.create_all(engine)   # or manage with Alembic

The Enum classes below map to the PostgreSQL ENUM types declared in
``schema.sql``; ``create_type=False`` keeps SQLAlchemy from trying to
re-create types that the SQL migration already owns.
"""

from __future__ import annotations

import datetime as dt
import enum
import uuid
from decimal import Decimal

from sqlalchemy import (
    ARRAY,
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import CITEXT, ENUM, INET, JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Declarative base for every RAF table."""


# --------------------------------------------------------------------------- #
# Enum domains (must match the ENUM types created in schema.sql)
# --------------------------------------------------------------------------- #
class LanguageCode(str, enum.Enum):
    ar = "ar"
    en = "en"


class UserStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    suspended = "suspended"
    pending = "pending"


class VendorStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    suspended = "suspended"


class ProductStatus(str, enum.Enum):
    draft = "draft"
    pending = "pending"
    published = "published"
    rejected = "rejected"
    archived = "archived"


class OrderStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    processing = "processing"
    shipped = "shipped"
    delivered = "delivered"
    cancelled = "cancelled"
    refunded = "refunded"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    authorized = "authorized"
    paid = "paid"
    failed = "failed"
    refunded = "refunded"
    partially_refunded = "partially_refunded"


class PaymentGateway(str, enum.Enum):
    thawani = "thawani"
    omannet = "omannet"
    stripe = "stripe"
    paypal = "paypal"
    cod = "cod"


class ShipmentStatus(str, enum.Enum):
    pending = "pending"
    picked_up = "picked_up"
    in_transit = "in_transit"
    out_for_delivery = "out_for_delivery"
    delivered = "delivered"
    failed = "failed"
    returned = "returned"


class CarrierCode(str, enum.Enum):
    aramex = "aramex"
    dhl = "dhl"
    fedex = "fedex"
    local = "local"


class ReturnStatus(str, enum.Enum):
    requested = "requested"
    approved = "approved"
    rejected = "rejected"
    received = "received"
    completed = "completed"


class PayoutStatus(str, enum.Enum):
    requested = "requested"
    approved = "approved"
    processing = "processing"
    paid = "paid"
    rejected = "rejected"


class NotificationChannel(str, enum.Enum):
    push = "push"
    email = "email"
    sms = "sms"
    in_app = "in_app"


class AIJobType(str, enum.Enum):
    product_generator = "product_generator"
    image_processing = "image_processing"
    analytics = "analytics"
    marketing = "marketing"
    shopping_assistant = "shopping_assistant"


class AIJobStatus(str, enum.Enum):
    queued = "queued"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"


class CampaignChannel(str, enum.Enum):
    social = "social"
    email = "email"
    sms = "sms"
    ads = "ads"


def pg_enum(py_enum: type[enum.Enum], name: str) -> ENUM:
    """Bind a Python enum to an existing PostgreSQL ENUM type."""
    return ENUM(py_enum, name=name, create_type=False, values_callable=lambda e: [m.value for m in e])


# Reusable column helpers ---------------------------------------------------- #
def created_ts() -> Mapped[dt.datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


def updated_ts() -> Mapped[dt.datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


MONEY = Numeric(14, 3)  # OMR has 3 decimal places


# --------------------------------------------------------------------------- #
# 1. Identity, Auth & RBAC
# --------------------------------------------------------------------------- #
class AppUser(Base):
    __tablename__ = "app_user"

    user_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(CITEXT, unique=True)
    phone: Mapped[str | None] = mapped_column(String(20), unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    preferred_lang: Mapped[LanguageCode] = mapped_column(
        pg_enum(LanguageCode, "language_code"), default=LanguageCode.ar)
    status: Mapped[UserStatus] = mapped_column(
        pg_enum(UserStatus, "user_status"), default=UserStatus.pending)
    twofa_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    twofa_secret: Mapped[str | None] = mapped_column(Text)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    phone_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    last_login_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[dt.datetime] = created_ts()
    updated_at: Mapped[dt.datetime] = updated_ts()
    deleted_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))

    roles: Mapped[list["UserRole"]] = relationship(back_populates="user")
    addresses: Mapped[list["Address"]] = relationship(back_populates="user")
    orders: Mapped[list["CustomerOrder"]] = relationship(back_populates="user")


class Role(Base):
    __tablename__ = "role"

    role_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role_key: Mapped[str] = mapped_column(String(40), unique=True)
    name_ar: Mapped[str] = mapped_column(String(80))
    name_en: Mapped[str] = mapped_column(String(80))
    description: Mapped[str | None] = mapped_column(Text)


class Permission(Base):
    __tablename__ = "permission"

    permission_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    perm_key: Mapped[str] = mapped_column(String(80), unique=True)
    description: Mapped[str | None] = mapped_column(Text)


class RolePermission(Base):
    __tablename__ = "role_permission"

    role_id: Mapped[int] = mapped_column(ForeignKey("role.role_id", ondelete="CASCADE"), primary_key=True)
    permission_id: Mapped[int] = mapped_column(
        ForeignKey("permission.permission_id", ondelete="CASCADE"), primary_key=True)


class UserRole(Base):
    __tablename__ = "user_role"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("app_user.user_id", ondelete="CASCADE"), primary_key=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("role.role_id", ondelete="CASCADE"), primary_key=True)

    user: Mapped["AppUser"] = relationship(back_populates="roles")
    role: Mapped["Role"] = relationship()


class AuthSession(Base):
    __tablename__ = "auth_session"

    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[int] = mapped_column(ForeignKey("app_user.user_id", ondelete="CASCADE"))
    refresh_hash: Mapped[str] = mapped_column(Text)
    user_agent: Mapped[str | None] = mapped_column(Text)
    ip_address: Mapped[str | None] = mapped_column(INET)
    expires_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[dt.datetime] = created_ts()


class ActivityLog(Base):
    __tablename__ = "activity_log"

    log_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("app_user.user_id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String(80))
    entity_type: Mapped[str | None] = mapped_column(String(60))
    entity_id: Mapped[str | None] = mapped_column(String(60))
    ip_address: Mapped[str | None] = mapped_column(INET)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB)
    created_at: Mapped[dt.datetime] = created_ts()


# --------------------------------------------------------------------------- #
# 2. Geography & Addresses
# --------------------------------------------------------------------------- #
class Country(Base):
    __tablename__ = "country"

    country_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    iso_code: Mapped[str] = mapped_column(String(2), unique=True)
    name_ar: Mapped[str] = mapped_column(String(80))
    name_en: Mapped[str] = mapped_column(String(80))


class Region(Base):
    __tablename__ = "region"

    region_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    country_id: Mapped[int] = mapped_column(ForeignKey("country.country_id", ondelete="CASCADE"))
    name_ar: Mapped[str] = mapped_column(String(80))
    name_en: Mapped[str] = mapped_column(String(80))


class City(Base):
    __tablename__ = "city"

    city_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    region_id: Mapped[int] = mapped_column(ForeignKey("region.region_id", ondelete="CASCADE"))
    name_ar: Mapped[str] = mapped_column(String(80))
    name_en: Mapped[str] = mapped_column(String(80))


class Address(Base):
    __tablename__ = "address"

    address_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("app_user.user_id", ondelete="CASCADE"))
    label: Mapped[str | None] = mapped_column(String(40))
    recipient: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(20))
    city_id: Mapped[int | None] = mapped_column(ForeignKey("city.city_id", ondelete="SET NULL"))
    line1: Mapped[str] = mapped_column(String(200))
    line2: Mapped[str | None] = mapped_column(String(200))
    postal_code: Mapped[str | None] = mapped_column(String(20))
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[dt.datetime] = created_ts()

    user: Mapped["AppUser"] = relationship(back_populates="addresses")


# --------------------------------------------------------------------------- #
# 3. Vendors
# --------------------------------------------------------------------------- #
class Vendor(Base):
    __tablename__ = "vendor"

    vendor_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    owner_user_id: Mapped[int] = mapped_column(ForeignKey("app_user.user_id", ondelete="RESTRICT"))
    store_name_ar: Mapped[str] = mapped_column(String(150))
    store_name_en: Mapped[str] = mapped_column(String(150))
    slug: Mapped[str] = mapped_column(String(160), unique=True)
    description_ar: Mapped[str | None] = mapped_column(Text)
    description_en: Mapped[str | None] = mapped_column(Text)
    logo_url: Mapped[str | None] = mapped_column(Text)
    banner_url: Mapped[str | None] = mapped_column(Text)
    status: Mapped[VendorStatus] = mapped_column(
        pg_enum(VendorStatus, "vendor_status"), default=VendorStatus.pending)
    commission_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("10.00"))
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("app_user.user_id", ondelete="SET NULL"))
    approved_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[dt.datetime] = created_ts()
    updated_at: Mapped[dt.datetime] = updated_ts()
    deleted_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))

    products: Mapped[list["Product"]] = relationship(back_populates="vendor")


class VendorStaff(Base):
    __tablename__ = "vendor_staff"

    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendor.vendor_id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("app_user.user_id", ondelete="CASCADE"), primary_key=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("role.role_id", ondelete="RESTRICT"))
    created_at: Mapped[dt.datetime] = created_ts()


class VendorWallet(Base):
    __tablename__ = "vendor_wallet"

    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendor.vendor_id", ondelete="CASCADE"), primary_key=True)
    available_balance: Mapped[Decimal] = mapped_column(MONEY, default=Decimal("0"))
    pending_balance: Mapped[Decimal] = mapped_column(MONEY, default=Decimal("0"))
    currency: Mapped[str] = mapped_column(String(3), default="OMR")
    updated_at: Mapped[dt.datetime] = updated_ts()


# --------------------------------------------------------------------------- #
# 4. Catalog
# --------------------------------------------------------------------------- #
class Category(Base):
    __tablename__ = "category"

    category_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("category.category_id", ondelete="SET NULL"))
    name_ar: Mapped[str] = mapped_column(String(120))
    name_en: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(140), unique=True)
    image_url: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Brand(Base):
    __tablename__ = "brand"

    brand_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name_ar: Mapped[str] = mapped_column(String(120))
    name_en: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(140), unique=True)
    logo_url: Mapped[str | None] = mapped_column(Text)


class Product(Base):
    __tablename__ = "product"

    product_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendor.vendor_id", ondelete="CASCADE"))
    category_id: Mapped[int | None] = mapped_column(ForeignKey("category.category_id", ondelete="SET NULL"))
    brand_id: Mapped[int | None] = mapped_column(ForeignKey("brand.brand_id", ondelete="SET NULL"))
    name_ar: Mapped[str] = mapped_column(String(200))
    name_en: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(220), unique=True)
    description_ar: Mapped[str | None] = mapped_column(Text)
    description_en: Mapped[str | None] = mapped_column(Text)
    seo_title: Mapped[str | None] = mapped_column(String(200))
    seo_description: Mapped[str | None] = mapped_column(Text)
    tags: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    base_price: Mapped[Decimal] = mapped_column(MONEY)
    status: Mapped[ProductStatus] = mapped_column(
        pg_enum(ProductStatus, "product_status"), default=ProductStatus.draft)
    rating_avg: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=Decimal("0"))
    rating_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[dt.datetime] = created_ts()
    updated_at: Mapped[dt.datetime] = updated_ts()
    deleted_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (CheckConstraint("base_price >= 0", name="product_base_price_check"),)

    vendor: Mapped["Vendor"] = relationship(back_populates="products")
    variants: Mapped[list["ProductVariant"]] = relationship(back_populates="product")
    images: Mapped[list["ProductImage"]] = relationship(
        "ProductImage", order_by="ProductImage.sort_order")


class Attribute(Base):
    __tablename__ = "attribute"

    attribute_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(40), unique=True)
    name_ar: Mapped[str] = mapped_column(String(80))
    name_en: Mapped[str] = mapped_column(String(80))


class AttributeValue(Base):
    __tablename__ = "attribute_value"

    attr_value_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    attribute_id: Mapped[int] = mapped_column(ForeignKey("attribute.attribute_id", ondelete="CASCADE"))
    value_ar: Mapped[str] = mapped_column(String(80))
    value_en: Mapped[str] = mapped_column(String(80))
    hex_color: Mapped[str | None] = mapped_column(String(7))


class ProductVariant(Base):
    __tablename__ = "product_variant"

    variant_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("product.product_id", ondelete="CASCADE"))
    sku: Mapped[str] = mapped_column(String(60), unique=True)
    barcode: Mapped[str | None] = mapped_column(String(60), unique=True)
    price: Mapped[Decimal] = mapped_column(MONEY)
    compare_at_price: Mapped[Decimal | None] = mapped_column(MONEY)
    weight_grams: Mapped[int | None] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[dt.datetime] = created_ts()

    __table_args__ = (CheckConstraint("price >= 0", name="variant_price_check"),)

    product: Mapped["Product"] = relationship(back_populates="variants")
    inventory: Mapped["Inventory"] = relationship(back_populates="variant", uselist=False)


class VariantAttribute(Base):
    __tablename__ = "variant_attribute"

    variant_id: Mapped[int] = mapped_column(
        ForeignKey("product_variant.variant_id", ondelete="CASCADE"), primary_key=True)
    attr_value_id: Mapped[int] = mapped_column(
        ForeignKey("attribute_value.attr_value_id", ondelete="RESTRICT"), primary_key=True)


class ProductImage(Base):
    __tablename__ = "product_image"

    image_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("product.product_id", ondelete="CASCADE"))
    variant_id: Mapped[int | None] = mapped_column(
        ForeignKey("product_variant.variant_id", ondelete="CASCADE"))
    url: Mapped[str] = mapped_column(Text)
    alt_text: Mapped[str | None] = mapped_column(String(200))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_ai_processed: Mapped[bool] = mapped_column(Boolean, default=False)


class Inventory(Base):
    __tablename__ = "inventory"

    variant_id: Mapped[int] = mapped_column(
        ForeignKey("product_variant.variant_id", ondelete="CASCADE"), primary_key=True)
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    reserved: Mapped[int] = mapped_column(Integer, default=0)
    low_stock_threshold: Mapped[int] = mapped_column(Integer, default=5)
    updated_at: Mapped[dt.datetime] = updated_ts()

    __table_args__ = (
        CheckConstraint("quantity >= 0", name="inventory_quantity_check"),
        CheckConstraint("reserved >= 0", name="inventory_reserved_check"),
    )

    variant: Mapped["ProductVariant"] = relationship(back_populates="inventory")


# --------------------------------------------------------------------------- #
# 5. Customer engagement
# --------------------------------------------------------------------------- #
class Cart(Base):
    __tablename__ = "cart"

    cart_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("app_user.user_id", ondelete="CASCADE"))
    created_at: Mapped[dt.datetime] = created_ts()
    updated_at: Mapped[dt.datetime] = updated_ts()

    items: Mapped[list["CartItem"]] = relationship(back_populates="cart")


class CartItem(Base):
    __tablename__ = "cart_item"

    cart_id: Mapped[int] = mapped_column(ForeignKey("cart.cart_id", ondelete="CASCADE"), primary_key=True)
    variant_id: Mapped[int] = mapped_column(
        ForeignKey("product_variant.variant_id", ondelete="CASCADE"), primary_key=True)
    quantity: Mapped[int] = mapped_column(Integer)
    added_at: Mapped[dt.datetime] = created_ts()

    __table_args__ = (CheckConstraint("quantity > 0", name="cart_item_quantity_check"),)

    cart: Mapped["Cart"] = relationship(back_populates="items")


class WishlistItem(Base):
    __tablename__ = "wishlist_item"

    user_id: Mapped[int] = mapped_column(ForeignKey("app_user.user_id", ondelete="CASCADE"), primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("product.product_id", ondelete="CASCADE"), primary_key=True)
    added_at: Mapped[dt.datetime] = created_ts()


class Review(Base):
    __tablename__ = "review"

    review_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("product.product_id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("app_user.user_id", ondelete="CASCADE"))
    rating: Mapped[int] = mapped_column(SmallInteger)
    title: Mapped[str | None] = mapped_column(String(150))
    body: Mapped[str | None] = mapped_column(Text)
    is_verified_purchase: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[dt.datetime] = created_ts()

    __table_args__ = (
        CheckConstraint("rating BETWEEN 1 AND 5", name="review_rating_check"),
        UniqueConstraint("product_id", "user_id", name="review_product_user_uk"),
    )


# --------------------------------------------------------------------------- #
# 6. Orders
# --------------------------------------------------------------------------- #
class CustomerOrder(Base):
    __tablename__ = "customer_order"

    order_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    order_number: Mapped[str] = mapped_column(String(24), unique=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("app_user.user_id", ondelete="RESTRICT"))
    status: Mapped[OrderStatus] = mapped_column(
        pg_enum(OrderStatus, "order_status"), default=OrderStatus.pending)
    currency: Mapped[str] = mapped_column(String(3), default="OMR")
    subtotal: Mapped[Decimal] = mapped_column(MONEY, default=Decimal("0"))
    shipping_total: Mapped[Decimal] = mapped_column(MONEY, default=Decimal("0"))
    discount_total: Mapped[Decimal] = mapped_column(MONEY, default=Decimal("0"))
    tax_total: Mapped[Decimal] = mapped_column(MONEY, default=Decimal("0"))
    grand_total: Mapped[Decimal] = mapped_column(MONEY, default=Decimal("0"))
    shipping_address_id: Mapped[int | None] = mapped_column(
        ForeignKey("address.address_id", ondelete="SET NULL"))
    placed_at: Mapped[dt.datetime] = created_ts()
    updated_at: Mapped[dt.datetime] = updated_ts()

    user: Mapped["AppUser"] = relationship(back_populates="orders")
    items: Mapped[list["OrderItem"]] = relationship(back_populates="order")


class OrderItem(Base):
    __tablename__ = "order_item"

    order_item_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("customer_order.order_id", ondelete="CASCADE"))
    variant_id: Mapped[int] = mapped_column(ForeignKey("product_variant.variant_id", ondelete="RESTRICT"))
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendor.vendor_id", ondelete="RESTRICT"))
    product_name: Mapped[str] = mapped_column(String(200))
    sku: Mapped[str] = mapped_column(String(60))
    unit_price: Mapped[Decimal] = mapped_column(MONEY)
    quantity: Mapped[int] = mapped_column(Integer)
    line_total: Mapped[Decimal] = mapped_column(MONEY)
    commission_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    commission_amount: Mapped[Decimal] = mapped_column(MONEY)

    __table_args__ = (CheckConstraint("quantity > 0", name="order_item_quantity_check"),)

    order: Mapped["CustomerOrder"] = relationship(back_populates="items")


class ReturnRequest(Base):
    __tablename__ = "return_request"

    return_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    order_item_id: Mapped[int] = mapped_column(ForeignKey("order_item.order_item_id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("app_user.user_id", ondelete="RESTRICT"))
    quantity: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str | None] = mapped_column(Text)
    status: Mapped[ReturnStatus] = mapped_column(
        pg_enum(ReturnStatus, "return_status"), default=ReturnStatus.requested)
    created_at: Mapped[dt.datetime] = created_ts()
    resolved_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (CheckConstraint("quantity > 0", name="return_quantity_check"),)


# --------------------------------------------------------------------------- #
# 7. Payments
# --------------------------------------------------------------------------- #
class Payment(Base):
    __tablename__ = "payment"

    payment_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("customer_order.order_id", ondelete="RESTRICT"))
    gateway: Mapped[PaymentGateway] = mapped_column(pg_enum(PaymentGateway, "payment_gateway"))
    status: Mapped[PaymentStatus] = mapped_column(
        pg_enum(PaymentStatus, "payment_status"), default=PaymentStatus.pending)
    amount: Mapped[Decimal] = mapped_column(MONEY)
    currency: Mapped[str] = mapped_column(String(3), default="OMR")
    gateway_ref: Mapped[str | None] = mapped_column(String(120))
    paid_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[dt.datetime] = created_ts()
    raw_response: Mapped[dict | None] = mapped_column(JSONB)

    __table_args__ = (CheckConstraint("amount >= 0", name="payment_amount_check"),)


class Refund(Base):
    __tablename__ = "refund"

    refund_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    payment_id: Mapped[int] = mapped_column(ForeignKey("payment.payment_id", ondelete="RESTRICT"))
    return_id: Mapped[int | None] = mapped_column(ForeignKey("return_request.return_id", ondelete="SET NULL"))
    amount: Mapped[Decimal] = mapped_column(MONEY)
    reason: Mapped[str | None] = mapped_column(Text)
    gateway_ref: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[dt.datetime] = created_ts()

    __table_args__ = (CheckConstraint("amount > 0", name="refund_amount_check"),)


class Payout(Base):
    __tablename__ = "payout"

    payout_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendor.vendor_id", ondelete="RESTRICT"))
    amount: Mapped[Decimal] = mapped_column(MONEY)
    currency: Mapped[str] = mapped_column(String(3), default="OMR")
    status: Mapped[PayoutStatus] = mapped_column(
        pg_enum(PayoutStatus, "payout_status"), default=PayoutStatus.requested)
    bank_iban: Mapped[str | None] = mapped_column(String(34))
    requested_at: Mapped[dt.datetime] = created_ts()
    processed_by: Mapped[int | None] = mapped_column(ForeignKey("app_user.user_id", ondelete="SET NULL"))
    processed_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (CheckConstraint("amount > 0", name="payout_amount_check"),)


class WalletTransaction(Base):
    __tablename__ = "wallet_transaction"

    txn_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendor.vendor_id", ondelete="CASCADE"))
    order_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("order_item.order_item_id", ondelete="SET NULL"))
    payout_id: Mapped[int | None] = mapped_column(ForeignKey("payout.payout_id", ondelete="SET NULL"))
    direction: Mapped[str] = mapped_column(String(6))
    amount: Mapped[Decimal] = mapped_column(MONEY)
    description: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[dt.datetime] = created_ts()

    __table_args__ = (
        CheckConstraint("direction IN ('credit','debit')", name="wallet_txn_direction_check"),
        CheckConstraint("amount > 0", name="wallet_txn_amount_check"),
    )


# --------------------------------------------------------------------------- #
# 8. Shipping
# --------------------------------------------------------------------------- #
class Shipment(Base):
    __tablename__ = "shipment"

    shipment_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("customer_order.order_id", ondelete="CASCADE"))
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendor.vendor_id", ondelete="RESTRICT"))
    carrier: Mapped[CarrierCode] = mapped_column(pg_enum(CarrierCode, "carrier_code"))
    tracking_number: Mapped[str | None] = mapped_column(String(80))
    status: Mapped[ShipmentStatus] = mapped_column(
        pg_enum(ShipmentStatus, "shipment_status"), default=ShipmentStatus.pending)
    shipped_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    cost: Mapped[Decimal | None] = mapped_column(MONEY)
    created_at: Mapped[dt.datetime] = created_ts()

    events: Mapped[list["ShipmentEvent"]] = relationship(back_populates="shipment")


class ShipmentEvent(Base):
    __tablename__ = "shipment_event"

    event_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    shipment_id: Mapped[int] = mapped_column(ForeignKey("shipment.shipment_id", ondelete="CASCADE"))
    status: Mapped[ShipmentStatus] = mapped_column(pg_enum(ShipmentStatus, "shipment_status"))
    location: Mapped[str | None] = mapped_column(String(150))
    note: Mapped[str | None] = mapped_column(Text)
    occurred_at: Mapped[dt.datetime] = created_ts()

    shipment: Mapped["Shipment"] = relationship(back_populates="events")


# --------------------------------------------------------------------------- #
# 9. Notifications
# --------------------------------------------------------------------------- #
class Notification(Base):
    __tablename__ = "notification"

    notification_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("app_user.user_id", ondelete="CASCADE"))
    channel: Mapped[NotificationChannel] = mapped_column(pg_enum(NotificationChannel, "notification_channel"))
    title_ar: Mapped[str | None] = mapped_column(String(160))
    title_en: Mapped[str | None] = mapped_column(String(160))
    body_ar: Mapped[str | None] = mapped_column(Text)
    body_en: Mapped[str | None] = mapped_column(Text)
    payload: Mapped[dict | None] = mapped_column(JSONB)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    sent_at: Mapped[dt.datetime] = created_ts()


class DeviceToken(Base):
    __tablename__ = "device_token"

    token_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("app_user.user_id", ondelete="CASCADE"))
    token: Mapped[str] = mapped_column(Text, unique=True)
    platform: Mapped[str] = mapped_column(String(10))
    created_at: Mapped[dt.datetime] = created_ts()

    __table_args__ = (
        CheckConstraint("platform IN ('android','ios','web')", name="device_platform_check"),
    )


# --------------------------------------------------------------------------- #
# 10. AI layer
# --------------------------------------------------------------------------- #
class AIJob(Base):
    __tablename__ = "ai_job"

    job_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    job_type: Mapped[AIJobType] = mapped_column(pg_enum(AIJobType, "ai_job_type"))
    status: Mapped[AIJobStatus] = mapped_column(
        pg_enum(AIJobStatus, "ai_job_status"), default=AIJobStatus.queued)
    requested_by: Mapped[int | None] = mapped_column(ForeignKey("app_user.user_id", ondelete="SET NULL"))
    vendor_id: Mapped[int | None] = mapped_column(ForeignKey("vendor.vendor_id", ondelete="SET NULL"))
    entity_type: Mapped[str | None] = mapped_column(String(60))
    entity_id: Mapped[str | None] = mapped_column(String(60))
    input: Mapped[dict | None] = mapped_column(JSONB)
    output: Mapped[dict | None] = mapped_column(JSONB)
    model: Mapped[str | None] = mapped_column(String(80))
    tokens_used: Mapped[int | None] = mapped_column(Integer)
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[dt.datetime] = created_ts()
    completed_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))


class AIRecommendation(Base):
    __tablename__ = "ai_recommendation"

    rec_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("app_user.user_id", ondelete="CASCADE"))
    product_id: Mapped[int] = mapped_column(ForeignKey("product.product_id", ondelete="CASCADE"))
    score: Mapped[Decimal] = mapped_column(Numeric(6, 4))
    recommendation_type: Mapped[str] = mapped_column(String(40))
    generated_at: Mapped[dt.datetime] = created_ts()


class AIChatSession(Base):
    __tablename__ = "ai_chat_session"

    chat_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("app_user.user_id", ondelete="CASCADE"))
    started_at: Mapped[dt.datetime] = created_ts()

    messages: Mapped[list["AIChatMessage"]] = relationship(back_populates="chat")


class AIChatMessage(Base):
    __tablename__ = "ai_chat_message"

    message_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    chat_id: Mapped[int] = mapped_column(ForeignKey("ai_chat_session.chat_id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String(12))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[dt.datetime] = created_ts()

    __table_args__ = (
        CheckConstraint("role IN ('user','assistant','system')", name="chat_msg_role_check"),
    )

    chat: Mapped["AIChatSession"] = relationship(back_populates="messages")


class AIForecast(Base):
    __tablename__ = "ai_forecast"

    forecast_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    vendor_id: Mapped[int | None] = mapped_column(ForeignKey("vendor.vendor_id", ondelete="CASCADE"))
    product_id: Mapped[int | None] = mapped_column(ForeignKey("product.product_id", ondelete="CASCADE"))
    metric: Mapped[str] = mapped_column(String(40))
    horizon_date: Mapped[dt.date] = mapped_column(Date)
    predicted_value: Mapped[Decimal] = mapped_column(Numeric(16, 3))
    confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 4))
    generated_at: Mapped[dt.datetime] = created_ts()


# --------------------------------------------------------------------------- #
# 11. Marketing
# --------------------------------------------------------------------------- #
class MarketingCampaign(Base):
    __tablename__ = "marketing_campaign"

    campaign_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    vendor_id: Mapped[int | None] = mapped_column(ForeignKey("vendor.vendor_id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(150))
    channel: Mapped[CampaignChannel] = mapped_column(pg_enum(CampaignChannel, "campaign_channel"))
    content_ar: Mapped[str | None] = mapped_column(Text)
    content_en: Mapped[str | None] = mapped_column(Text)
    is_ai_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    starts_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[int | None] = mapped_column(ForeignKey("app_user.user_id", ondelete="SET NULL"))
    created_at: Mapped[dt.datetime] = created_ts()


class Coupon(Base):
    __tablename__ = "coupon"

    coupon_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    vendor_id: Mapped[int | None] = mapped_column(ForeignKey("vendor.vendor_id", ondelete="CASCADE"))
    code: Mapped[str] = mapped_column(String(40), unique=True)
    discount_type: Mapped[str] = mapped_column(String(10))
    discount_value: Mapped[Decimal] = mapped_column(MONEY)
    min_order_total: Mapped[Decimal | None] = mapped_column(MONEY)
    usage_limit: Mapped[int | None] = mapped_column(Integer)
    used_count: Mapped[int] = mapped_column(Integer, default=0)
    valid_from: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    valid_until: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    __table_args__ = (
        CheckConstraint("discount_type IN ('percent','fixed')", name="coupon_type_check"),
        CheckConstraint("discount_value > 0", name="coupon_value_check"),
    )
