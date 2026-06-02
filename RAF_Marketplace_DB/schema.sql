/* ============================================================================
   RAF MARKETPLACE — PostgreSQL Database Schema (DDL)
   ----------------------------------------------------------------------------
   AI-powered multi-vendor marketplace for Oman & the GCC.

   Design notes
   ------------
   - Bilingual content uses paired columns: *_ar (primary) and *_en (secondary).
   - BIGSERIAL / BIGINT identities are used for scale (1M+ users, 100K+ products).
   - Money is stored as NUMERIC(14,3) — Omani Rial (OMR) has 3 decimal places.
   - All operational tables carry created_at / updated_at audit timestamps.
   - ENUM types model fixed domains (statuses, gateways, roles, channels).
   - Soft-deletable tables expose a deleted_at column (NULL = active).
   - Foreign keys use ON DELETE rules chosen per relationship semantics.

   Apply with:   psql -d raf_marketplace -f schema.sql
   ============================================================================ */

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- case-insensitive emails

/* ============================================================================
   1. ENUM DOMAINS
   ============================================================================ */

CREATE TYPE language_code      AS ENUM ('ar', 'en');
CREATE TYPE user_status        AS ENUM ('active', 'inactive', 'suspended', 'pending');
CREATE TYPE vendor_status      AS ENUM ('pending', 'approved', 'rejected', 'suspended');
CREATE TYPE product_status     AS ENUM ('draft', 'pending', 'published', 'rejected', 'archived');
CREATE TYPE order_status        AS ENUM ('pending', 'confirmed', 'processing', 'shipped',
                                         'delivered', 'cancelled', 'refunded');
CREATE TYPE payment_status      AS ENUM ('pending', 'authorized', 'paid', 'failed',
                                         'refunded', 'partially_refunded');
CREATE TYPE payment_gateway     AS ENUM ('thawani', 'omannet', 'stripe', 'paypal', 'cod');
CREATE TYPE shipment_status     AS ENUM ('pending', 'picked_up', 'in_transit',
                                         'out_for_delivery', 'delivered', 'failed', 'returned');
CREATE TYPE carrier_code        AS ENUM ('aramex', 'dhl', 'fedex', 'local');
CREATE TYPE return_status       AS ENUM ('requested', 'approved', 'rejected', 'received', 'completed');
CREATE TYPE payout_status       AS ENUM ('requested', 'approved', 'processing', 'paid', 'rejected');
CREATE TYPE notification_channel AS ENUM ('push', 'email', 'sms', 'in_app');
CREATE TYPE ai_job_type         AS ENUM ('product_generator', 'image_processing',
                                         'analytics', 'marketing', 'shopping_assistant');
CREATE TYPE ai_job_status       AS ENUM ('queued', 'running', 'succeeded', 'failed');
CREATE TYPE campaign_channel    AS ENUM ('social', 'email', 'sms', 'ads');

/* ============================================================================
   2. IDENTITY, AUTH & RBAC
   ============================================================================ */

/* Application users (customers, vendor staff, admins all live here). */
CREATE TABLE app_user (
    user_id        BIGSERIAL PRIMARY KEY,
    full_name      VARCHAR(120)  NOT NULL,
    email          CITEXT        UNIQUE NOT NULL,
    phone          VARCHAR(20)   UNIQUE,
    password_hash  TEXT          NOT NULL,
    preferred_lang language_code NOT NULL DEFAULT 'ar',
    status         user_status   NOT NULL DEFAULT 'pending',
    -- Two-Factor Authentication
    twofa_enabled  BOOLEAN       NOT NULL DEFAULT FALSE,
    twofa_secret   TEXT,
    email_verified BOOLEAN       NOT NULL DEFAULT FALSE,
    phone_verified BOOLEAN       NOT NULL DEFAULT FALSE,
    last_login_at  TIMESTAMPTZ,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    deleted_at     TIMESTAMPTZ
);

/* Role-Based Access Control. */
CREATE TABLE role (
    role_id     SERIAL PRIMARY KEY,
    role_key    VARCHAR(40) UNIQUE NOT NULL,   -- e.g. 'customer','vendor_owner','admin'
    name_ar     VARCHAR(80) NOT NULL,
    name_en     VARCHAR(80) NOT NULL,
    description TEXT
);

CREATE TABLE permission (
    permission_id SERIAL PRIMARY KEY,
    perm_key      VARCHAR(80) UNIQUE NOT NULL,  -- e.g. 'product.create','vendor.approve'
    description   TEXT
);

CREATE TABLE role_permission (
    role_id       INT NOT NULL REFERENCES role(role_id)       ON DELETE CASCADE,
    permission_id INT NOT NULL REFERENCES permission(permission_id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_role (
    user_id BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    role_id INT    NOT NULL REFERENCES role(role_id)      ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

/* Refresh / session tokens supporting JWT auth. */
CREATE TABLE auth_session (
    session_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    refresh_hash TEXT   NOT NULL,
    user_agent   TEXT,
    ip_address   INET,
    expires_at   TIMESTAMPTZ NOT NULL,
    revoked_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* Security activity / audit log. */
CREATE TABLE activity_log (
    log_id      BIGSERIAL PRIMARY KEY,
    user_id     BIGINT REFERENCES app_user(user_id) ON DELETE SET NULL,
    action      VARCHAR(80) NOT NULL,
    entity_type VARCHAR(60),
    entity_id   VARCHAR(60),
    ip_address  INET,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* ============================================================================
   3. GEOGRAPHY & ADDRESSES (GCC regions)
   ============================================================================ */

CREATE TABLE country (
    country_id SERIAL PRIMARY KEY,
    iso_code   CHAR(2) UNIQUE NOT NULL,   -- OM, AE, SA, ...
    name_ar    VARCHAR(80) NOT NULL,
    name_en    VARCHAR(80) NOT NULL
);

CREATE TABLE region (
    region_id  SERIAL PRIMARY KEY,
    country_id INT NOT NULL REFERENCES country(country_id) ON DELETE CASCADE,
    name_ar    VARCHAR(80) NOT NULL,
    name_en    VARCHAR(80) NOT NULL
);

CREATE TABLE city (
    city_id   SERIAL PRIMARY KEY,
    region_id INT NOT NULL REFERENCES region(region_id) ON DELETE CASCADE,
    name_ar   VARCHAR(80) NOT NULL,
    name_en   VARCHAR(80) NOT NULL
);

CREATE TABLE address (
    address_id   BIGSERIAL PRIMARY KEY,
    user_id      BIGINT REFERENCES app_user(user_id) ON DELETE CASCADE,
    label        VARCHAR(40),               -- 'home', 'work'
    recipient    VARCHAR(120) NOT NULL,
    phone        VARCHAR(20)  NOT NULL,
    city_id      INT REFERENCES city(city_id) ON DELETE SET NULL,
    line1        VARCHAR(200) NOT NULL,
    line2        VARCHAR(200),
    postal_code  VARCHAR(20),
    latitude     NUMERIC(9,6),
    longitude    NUMERIC(9,6),
    is_default   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* ============================================================================
   4. VENDORS / STORES
   ============================================================================ */

CREATE TABLE vendor (
    vendor_id       BIGSERIAL PRIMARY KEY,
    owner_user_id   BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE RESTRICT,
    store_name_ar   VARCHAR(150) NOT NULL,
    store_name_en   VARCHAR(150) NOT NULL,
    slug            VARCHAR(160) UNIQUE NOT NULL,
    description_ar  TEXT,
    description_en  TEXT,
    logo_url        TEXT,
    banner_url      TEXT,
    status          vendor_status NOT NULL DEFAULT 'pending',
    commission_rate NUMERIC(5,2)  NOT NULL DEFAULT 10.00,   -- percent
    approved_by     BIGINT REFERENCES app_user(user_id) ON DELETE SET NULL,
    approved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

/* Vendor staff (maps users to a vendor with a store-scoped role). */
CREATE TABLE vendor_staff (
    vendor_id BIGINT NOT NULL REFERENCES vendor(vendor_id)   ON DELETE CASCADE,
    user_id   BIGINT NOT NULL REFERENCES app_user(user_id)   ON DELETE CASCADE,
    role_id   INT    NOT NULL REFERENCES role(role_id)        ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (vendor_id, user_id)
);

/* Vendor financial balance (running ledger summary). */
CREATE TABLE vendor_wallet (
    vendor_id        BIGINT PRIMARY KEY REFERENCES vendor(vendor_id) ON DELETE CASCADE,
    available_balance NUMERIC(14,3) NOT NULL DEFAULT 0,
    pending_balance   NUMERIC(14,3) NOT NULL DEFAULT 0,
    currency          CHAR(3) NOT NULL DEFAULT 'OMR',
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* ============================================================================
   5. CATALOG: CATEGORIES, BRANDS, PRODUCTS, VARIANTS
   ============================================================================ */

CREATE TABLE category (
    category_id  SERIAL PRIMARY KEY,
    parent_id    INT REFERENCES category(category_id) ON DELETE SET NULL,
    name_ar      VARCHAR(120) NOT NULL,
    name_en      VARCHAR(120) NOT NULL,
    slug         VARCHAR(140) UNIQUE NOT NULL,
    image_url    TEXT,
    sort_order   INT NOT NULL DEFAULT 0,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE brand (
    brand_id  SERIAL PRIMARY KEY,
    name_ar   VARCHAR(120) NOT NULL,
    name_en   VARCHAR(120) NOT NULL,
    slug      VARCHAR(140) UNIQUE NOT NULL,
    logo_url  TEXT
);

CREATE TABLE product (
    product_id     BIGSERIAL PRIMARY KEY,
    vendor_id      BIGINT NOT NULL REFERENCES vendor(vendor_id)     ON DELETE CASCADE,
    category_id    INT    REFERENCES category(category_id)          ON DELETE SET NULL,
    brand_id       INT    REFERENCES brand(brand_id)                ON DELETE SET NULL,
    name_ar        VARCHAR(200) NOT NULL,
    name_en        VARCHAR(200) NOT NULL,
    slug           VARCHAR(220) UNIQUE NOT NULL,
    description_ar TEXT,
    description_en TEXT,
    -- SEO / AI-generated content
    seo_title      VARCHAR(200),
    seo_description TEXT,
    tags           TEXT[],
    base_price     NUMERIC(14,3) NOT NULL CHECK (base_price >= 0),
    status         product_status NOT NULL DEFAULT 'draft',
    rating_avg     NUMERIC(3,2) NOT NULL DEFAULT 0,
    rating_count   INT NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at     TIMESTAMPTZ
);

/* Variant attribute domains (color, size, ...). */
CREATE TABLE attribute (
    attribute_id SERIAL PRIMARY KEY,
    code         VARCHAR(40) UNIQUE NOT NULL,   -- 'color','size'
    name_ar      VARCHAR(80) NOT NULL,
    name_en      VARCHAR(80) NOT NULL
);

CREATE TABLE attribute_value (
    attr_value_id SERIAL PRIMARY KEY,
    attribute_id  INT NOT NULL REFERENCES attribute(attribute_id) ON DELETE CASCADE,
    value_ar      VARCHAR(80) NOT NULL,
    value_en      VARCHAR(80) NOT NULL,
    hex_color     CHAR(7)                       -- for color swatches, optional
);

/* A concrete sellable unit (SKU). A product with no real variants still has one. */
CREATE TABLE product_variant (
    variant_id   BIGSERIAL PRIMARY KEY,
    product_id   BIGINT NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,
    sku          VARCHAR(60) UNIQUE NOT NULL,
    barcode      VARCHAR(60) UNIQUE,
    price        NUMERIC(14,3) NOT NULL CHECK (price >= 0),
    compare_at_price NUMERIC(14,3),             -- "was" price for discounts
    weight_grams INT,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* Maps a variant to its attribute values (color=red, size=L). */
CREATE TABLE variant_attribute (
    variant_id    BIGINT NOT NULL REFERENCES product_variant(variant_id) ON DELETE CASCADE,
    attr_value_id INT    NOT NULL REFERENCES attribute_value(attr_value_id) ON DELETE RESTRICT,
    PRIMARY KEY (variant_id, attr_value_id)
);

CREATE TABLE product_image (
    image_id     BIGSERIAL PRIMARY KEY,
    product_id   BIGINT NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,
    variant_id   BIGINT REFERENCES product_variant(variant_id)  ON DELETE CASCADE,
    url          TEXT NOT NULL,
    alt_text     VARCHAR(200),
    sort_order   INT NOT NULL DEFAULT 0,
    is_ai_processed BOOLEAN NOT NULL DEFAULT FALSE   -- background-removed / enhanced
);

/* Inventory per variant (per-vendor stock; warehouse-ready). */
CREATE TABLE inventory (
    variant_id     BIGINT PRIMARY KEY REFERENCES product_variant(variant_id) ON DELETE CASCADE,
    quantity       INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    reserved       INT NOT NULL DEFAULT 0 CHECK (reserved >= 0),
    low_stock_threshold INT NOT NULL DEFAULT 5,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* ============================================================================
   6. CUSTOMER ENGAGEMENT: CART, WISHLIST, REVIEWS
   ============================================================================ */

CREATE TABLE cart (
    cart_id    BIGSERIAL PRIMARY KEY,
    user_id    BIGINT REFERENCES app_user(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cart_item (
    cart_id    BIGINT NOT NULL REFERENCES cart(cart_id) ON DELETE CASCADE,
    variant_id BIGINT NOT NULL REFERENCES product_variant(variant_id) ON DELETE CASCADE,
    quantity   INT NOT NULL CHECK (quantity > 0),
    added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (cart_id, variant_id)
);

CREATE TABLE wishlist_item (
    user_id    BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,
    added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, product_id)
);

CREATE TABLE review (
    review_id   BIGSERIAL PRIMARY KEY,
    product_id  BIGINT NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,
    user_id     BIGINT NOT NULL REFERENCES app_user(user_id)   ON DELETE CASCADE,
    rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title       VARCHAR(150),
    body        TEXT,
    is_verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id, user_id)
);

/* ============================================================================
   7. ORDERS, ITEMS, RETURNS & REFUNDS
   ============================================================================ */

CREATE TABLE customer_order (
    order_id        BIGSERIAL PRIMARY KEY,
    order_number    VARCHAR(24) UNIQUE NOT NULL,    -- human-friendly, e.g. RAF-2026-000123
    user_id         BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE RESTRICT,
    status          order_status NOT NULL DEFAULT 'pending',
    currency        CHAR(3) NOT NULL DEFAULT 'OMR',
    subtotal        NUMERIC(14,3) NOT NULL DEFAULT 0,
    shipping_total  NUMERIC(14,3) NOT NULL DEFAULT 0,
    discount_total  NUMERIC(14,3) NOT NULL DEFAULT 0,
    tax_total       NUMERIC(14,3) NOT NULL DEFAULT 0,
    grand_total     NUMERIC(14,3) NOT NULL DEFAULT 0,
    shipping_address_id BIGINT REFERENCES address(address_id) ON DELETE SET NULL,
    placed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* One order can span multiple vendors; each line records its vendor for payout. */
CREATE TABLE order_item (
    order_item_id   BIGSERIAL PRIMARY KEY,
    order_id        BIGINT NOT NULL REFERENCES customer_order(order_id) ON DELETE CASCADE,
    variant_id      BIGINT NOT NULL REFERENCES product_variant(variant_id) ON DELETE RESTRICT,
    vendor_id       BIGINT NOT NULL REFERENCES vendor(vendor_id) ON DELETE RESTRICT,
    -- snapshot fields (price/name captured at purchase time)
    product_name    VARCHAR(200) NOT NULL,
    sku             VARCHAR(60)  NOT NULL,
    unit_price      NUMERIC(14,3) NOT NULL,
    quantity        INT NOT NULL CHECK (quantity > 0),
    line_total      NUMERIC(14,3) NOT NULL,
    commission_rate NUMERIC(5,2) NOT NULL,           -- % charged to vendor
    commission_amount NUMERIC(14,3) NOT NULL
);

CREATE TABLE return_request (
    return_id     BIGSERIAL PRIMARY KEY,
    order_item_id BIGINT NOT NULL REFERENCES order_item(order_item_id) ON DELETE CASCADE,
    user_id       BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE RESTRICT,
    quantity      INT NOT NULL CHECK (quantity > 0),
    reason        TEXT,
    status        return_status NOT NULL DEFAULT 'requested',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at   TIMESTAMPTZ
);

/* ============================================================================
   8. PAYMENTS, COMMISSIONS & VENDOR PAYOUTS
   ============================================================================ */

CREATE TABLE payment (
    payment_id     BIGSERIAL PRIMARY KEY,
    order_id       BIGINT NOT NULL REFERENCES customer_order(order_id) ON DELETE RESTRICT,
    gateway        payment_gateway NOT NULL,
    status         payment_status  NOT NULL DEFAULT 'pending',
    amount         NUMERIC(14,3) NOT NULL CHECK (amount >= 0),
    currency       CHAR(3) NOT NULL DEFAULT 'OMR',
    gateway_ref    VARCHAR(120),                 -- external transaction id
    paid_at        TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    raw_response   JSONB
);

CREATE TABLE refund (
    refund_id   BIGSERIAL PRIMARY KEY,
    payment_id  BIGINT NOT NULL REFERENCES payment(payment_id) ON DELETE RESTRICT,
    return_id   BIGINT REFERENCES return_request(return_id)    ON DELETE SET NULL,
    amount      NUMERIC(14,3) NOT NULL CHECK (amount > 0),
    reason      TEXT,
    gateway_ref VARCHAR(120),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* Vendor withdrawal / payout requests. */
CREATE TABLE payout (
    payout_id    BIGSERIAL PRIMARY KEY,
    vendor_id    BIGINT NOT NULL REFERENCES vendor(vendor_id) ON DELETE RESTRICT,
    amount       NUMERIC(14,3) NOT NULL CHECK (amount > 0),
    currency     CHAR(3) NOT NULL DEFAULT 'OMR',
    status       payout_status NOT NULL DEFAULT 'requested',
    bank_iban    VARCHAR(34),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_by BIGINT REFERENCES app_user(user_id) ON DELETE SET NULL,
    processed_at TIMESTAMPTZ
);

/* Append-only ledger of every balance movement for a vendor. */
CREATE TABLE wallet_transaction (
    txn_id      BIGSERIAL PRIMARY KEY,
    vendor_id   BIGINT NOT NULL REFERENCES vendor(vendor_id) ON DELETE CASCADE,
    order_item_id BIGINT REFERENCES order_item(order_item_id) ON DELETE SET NULL,
    payout_id   BIGINT REFERENCES payout(payout_id)           ON DELETE SET NULL,
    direction   VARCHAR(6) NOT NULL CHECK (direction IN ('credit','debit')),
    amount      NUMERIC(14,3) NOT NULL CHECK (amount > 0),
    description VARCHAR(200),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* ============================================================================
   9. SHIPPING & TRACKING
   ============================================================================ */

CREATE TABLE shipment (
    shipment_id     BIGSERIAL PRIMARY KEY,
    order_id        BIGINT NOT NULL REFERENCES customer_order(order_id) ON DELETE CASCADE,
    vendor_id       BIGINT NOT NULL REFERENCES vendor(vendor_id) ON DELETE RESTRICT,
    carrier         carrier_code NOT NULL,
    tracking_number VARCHAR(80),
    status          shipment_status NOT NULL DEFAULT 'pending',
    shipped_at      TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    cost            NUMERIC(14,3),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE shipment_event (
    event_id    BIGSERIAL PRIMARY KEY,
    shipment_id BIGINT NOT NULL REFERENCES shipment(shipment_id) ON DELETE CASCADE,
    status      shipment_status NOT NULL,
    location    VARCHAR(150),
    note        TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* ============================================================================
   10. NOTIFICATIONS
   ============================================================================ */

CREATE TABLE notification (
    notification_id BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    channel         notification_channel NOT NULL,
    title_ar        VARCHAR(160),
    title_en        VARCHAR(160),
    body_ar         TEXT,
    body_en         TEXT,
    payload         JSONB,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* Device tokens for push notifications (mobile apps). */
CREATE TABLE device_token (
    token_id   BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    token      TEXT NOT NULL,
    platform   VARCHAR(10) NOT NULL CHECK (platform IN ('android','ios','web')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (token)
);

/* ============================================================================
   11. AI LAYER
   ============================================================================ */

/* Generic AI job queue (product generator, image processing, analytics, ...). */
CREATE TABLE ai_job (
    job_id       BIGSERIAL PRIMARY KEY,
    job_type     ai_job_type NOT NULL,
    status       ai_job_status NOT NULL DEFAULT 'queued',
    requested_by BIGINT REFERENCES app_user(user_id) ON DELETE SET NULL,
    vendor_id    BIGINT REFERENCES vendor(vendor_id) ON DELETE SET NULL,
    entity_type  VARCHAR(60),
    entity_id    VARCHAR(60),
    input        JSONB,
    output       JSONB,
    model        VARCHAR(80),
    tokens_used  INT,
    error        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

/* AI-generated product recommendations (shopping assistant / personalization). */
CREATE TABLE ai_recommendation (
    rec_id          BIGSERIAL PRIMARY KEY,
    user_id         BIGINT REFERENCES app_user(user_id) ON DELETE CASCADE,
    product_id      BIGINT NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,
    score           NUMERIC(6,4) NOT NULL,
    recommendation_type VARCHAR(40) NOT NULL,   -- 'personalized','similar','trending'
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* Persisted AI shopping-assistant conversations. */
CREATE TABLE ai_chat_session (
    chat_id    BIGSERIAL PRIMARY KEY,
    user_id    BIGINT REFERENCES app_user(user_id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ai_chat_message (
    message_id  BIGSERIAL PRIMARY KEY,
    chat_id     BIGINT NOT NULL REFERENCES ai_chat_session(chat_id) ON DELETE CASCADE,
    role        VARCHAR(12) NOT NULL CHECK (role IN ('user','assistant','system')),
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* AI analytics outputs (forecasts, demand prediction, projections). */
CREATE TABLE ai_forecast (
    forecast_id  BIGSERIAL PRIMARY KEY,
    vendor_id    BIGINT REFERENCES vendor(vendor_id) ON DELETE CASCADE,
    product_id   BIGINT REFERENCES product(product_id) ON DELETE CASCADE,
    metric       VARCHAR(40) NOT NULL,           -- 'sales','demand','revenue','inventory'
    horizon_date DATE NOT NULL,
    predicted_value NUMERIC(16,3) NOT NULL,
    confidence   NUMERIC(5,4),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* ============================================================================
   12. MARKETING
   ============================================================================ */

CREATE TABLE marketing_campaign (
    campaign_id   BIGSERIAL PRIMARY KEY,
    vendor_id     BIGINT REFERENCES vendor(vendor_id) ON DELETE CASCADE,
    name          VARCHAR(150) NOT NULL,
    channel       campaign_channel NOT NULL,
    content_ar    TEXT,
    content_en    TEXT,
    is_ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
    starts_at     TIMESTAMPTZ,
    ends_at       TIMESTAMPTZ,
    created_by    BIGINT REFERENCES app_user(user_id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* Discount / coupon codes. */
CREATE TABLE coupon (
    coupon_id     BIGSERIAL PRIMARY KEY,
    vendor_id     BIGINT REFERENCES vendor(vendor_id) ON DELETE CASCADE,  -- NULL = platform-wide
    code          VARCHAR(40) UNIQUE NOT NULL,
    discount_type VARCHAR(10) NOT NULL CHECK (discount_type IN ('percent','fixed')),
    discount_value NUMERIC(14,3) NOT NULL CHECK (discount_value > 0),
    min_order_total NUMERIC(14,3),
    usage_limit   INT,
    used_count    INT NOT NULL DEFAULT 0,
    valid_from    TIMESTAMPTZ,
    valid_until   TIMESTAMPTZ,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

/* ============================================================================
   13. INDEXES (performance for marketplace scale)
   ============================================================================ */

CREATE INDEX idx_product_vendor      ON product(vendor_id);
CREATE INDEX idx_product_category    ON product(category_id);
CREATE INDEX idx_product_status      ON product(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_product_tags        ON product USING GIN(tags);
CREATE INDEX idx_variant_product     ON product_variant(product_id);
CREATE INDEX idx_order_user          ON customer_order(user_id);
CREATE INDEX idx_order_status        ON customer_order(status);
CREATE INDEX idx_order_item_order    ON order_item(order_id);
CREATE INDEX idx_order_item_vendor   ON order_item(vendor_id);
CREATE INDEX idx_payment_order       ON payment(order_id);
CREATE INDEX idx_shipment_order      ON shipment(order_id);
CREATE INDEX idx_review_product      ON review(product_id);
CREATE INDEX idx_cart_item_variant   ON cart_item(variant_id);
CREATE INDEX idx_activity_user       ON activity_log(user_id, created_at);
CREATE INDEX idx_ai_job_status       ON ai_job(status, job_type);
CREATE INDEX idx_ai_rec_user         ON ai_recommendation(user_id);
CREATE INDEX idx_notification_user   ON notification(user_id, is_read);

/* Full-text search across bilingual product names. */
CREATE INDEX idx_product_search ON product
    USING GIN (to_tsvector('simple', coalesce(name_ar,'') || ' ' || coalesce(name_en,'')));

COMMIT;

/* ============================================================================
   END OF SCHEMA
   ============================================================================ */
