# RAF Marketplace — Database Design

PostgreSQL schema for **RAF**, an AI-powered multi-vendor marketplace for the
**Oman & GCC** market. This design covers the full scope of the product
specification: multi-vendor catalog, orders, payments, shipping, the AI layer,
marketing, RBAC security, and full Arabic/English localization.

> Apply the schema:
> ```bash
> createdb raf_marketplace
> psql -d raf_marketplace -f schema.sql
> ```
> Validated against **PostgreSQL 16** (45 tables, applies with `ON_ERROR_STOP`).

---

## Design principles

| Principle | How it's applied |
|-----------|------------------|
| **Bilingual first** | Content tables carry `*_ar` (primary) + `*_en` (secondary) columns. |
| **Built for scale** | `BIGSERIAL` keys, targeted indexes, GIN full-text + tag indexes. |
| **Money safety** | `NUMERIC(14,3)` — OMR has **3** decimal places (baisa). |
| **Auditability** | `created_at` / `updated_at` everywhere; append-only `activity_log` & `wallet_transaction`. |
| **Fixed domains as enums** | Statuses, gateways, carriers, channels are PostgreSQL `ENUM` types. |
| **Multi-vendor orders** | An order can span vendors; `order_item` records its `vendor_id`, commission, and snapshots. |
| **Soft deletes** | Key entities (`app_user`, `vendor`, `product`) use `deleted_at`. |

---

## Module map

The 45 tables are grouped into 13 functional areas:

### 1. Identity, Auth & RBAC
`app_user`, `role`, `permission`, `role_permission`, `user_role`,
`auth_session`, `activity_log`
- JWT refresh sessions, **2FA** (`twofa_enabled`/`twofa_secret`), email/phone
  verification, and role-based access control via the `role`↔`permission` matrix.
- `activity_log` satisfies the spec's "Activity Logs" security requirement.

### 2. Geography & Addresses
`country`, `region`, `city`, `address`
- GCC-aware hierarchy (country → region → city) with geo-coordinates for
  delivery and default-address support.

### 3. Vendors / Stores
`vendor`, `vendor_staff`, `vendor_wallet`
- Vendor approval workflow (`status`, `approved_by`/`approved_at`),
  per-vendor `commission_rate`, store-scoped staff roles, and a wallet holding
  available/pending balances.

### 4. Catalog
`category` (self-referencing tree), `brand`, `product`, `attribute`,
`attribute_value`, `product_variant`, `variant_attribute`, `product_image`,
`inventory`
- **Variants** model the spec's colors/sizes via a flexible
  attribute → attribute_value → variant mapping (not hard-coded columns).
- Each variant is a sellable **SKU** with `barcode`, price, and `inventory`
  (quantity + reserved + low-stock threshold).
- `product.tags`, `seo_title`, `seo_description` hold **AI-generated SEO** output;
  `product_image.is_ai_processed` flags background-removed/enhanced images.

### 5. Customer Engagement
`cart`, `cart_item`, `wishlist_item`, `review`
- Persistent carts, wishlist, and one-review-per-user-per-product ratings that
  feed `product.rating_avg` / `rating_count`.

### 6. Orders, Returns & Refunds
`customer_order`, `order_item`, `return_request`
- Orders snapshot price/name at purchase time and compute commission per line.
- Returns are tracked per `order_item` with their own status lifecycle.

### 7. Payments, Commissions & Payouts
`payment`, `refund`, `payout`, `wallet_transaction`
- Supports **Thawani, OmanNet, Stripe, PayPal, Cash-on-Delivery** via the
  `payment_gateway` enum; `raw_response` keeps the gateway payload.
- Vendor **withdrawal requests** (`payout`) and an append-only ledger
  (`wallet_transaction`) reconcile every credit/debit.

### 8. Shipping & Tracking
`shipment`, `shipment_event`
- Carriers **Aramex / DHL / FedEx / local**; `shipment_event` provides the
  real-time tracking timeline (status + location + timestamp).

### 9. Notifications
`notification`, `device_token`
- Multi-channel (push/email/SMS/in-app), bilingual, with device tokens for
  mobile **push notifications**.

### 10. AI Layer
`ai_job`, `ai_recommendation`, `ai_chat_session`, `ai_chat_message`,
`ai_forecast`
- `ai_job` is a generic queue for the **product generator, image processing,
  analytics, and marketing** AI services (`input`/`output` JSONB, model, tokens).
- `ai_recommendation` powers personalized/similar/trending suggestions.
- `ai_chat_session`/`ai_chat_message` persist the **AI shopping assistant**.
- `ai_forecast` stores sales/demand/revenue/inventory predictions.

### 11. Marketing
`marketing_campaign`, `coupon`
- AI-generated campaigns across social/email/SMS/ads, plus discount coupons
  (platform-wide or vendor-scoped).

---

## Key relationships (ERD summary)

```
app_user 1───* user_role *───1 role *───* permission
app_user 1───* address
app_user 1───1 vendor (owner)         vendor 1───* product
vendor   1───* vendor_staff           product 1───* product_variant 1───1 inventory
vendor   1───1 vendor_wallet          product_variant *───* attribute_value
category 1───* product                product 1───* product_image / review

app_user 1───* customer_order 1───* order_item *───1 vendor
customer_order 1───* payment 1───* refund
customer_order 1───* shipment 1───* shipment_event
order_item 1───* return_request
vendor   1───* payout / wallet_transaction

app_user 1───* ai_chat_session 1───* ai_chat_message
app_user 1───* ai_recommendation *───1 product
vendor   1───* ai_forecast / marketing_campaign / ai_job
```

---

## Scale & performance notes

- **Indexes** target the hot paths: product browsing by vendor/category/status,
  order lookups by user/vendor, payment/shipment by order, and the AI job queue.
- **Full-text search** on bilingual product names via a GIN `tsvector` index;
  product **tags** indexed with GIN for filtering.
- For the 1M+ user / 100K+ product targets, candidate next steps:
  partition `customer_order` / `activity_log` by month, add read replicas,
  and cache hot catalog reads in Redis (already in the stack).

---

## Files

| File | Purpose |
|------|---------|
| `schema.sql`  | Complete DDL — extensions, enums, tables, constraints, indexes. |
| `views.sql`   | Reporting & analytics views (revenue, sales, vendor, customer, AI trends, low stock). |
| `queries.sql` | Common CRUD & query examples for application developers. |
| `seed.sql`    | Minimal reference + sample data for local development. |
| `ERD.md`      | Entity-relationship diagram (Mermaid, renders on GitHub). |

> This design is independent of the legacy HR database in `../SQL_commands/`.
