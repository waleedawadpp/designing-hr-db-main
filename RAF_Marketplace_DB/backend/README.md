# RAF Marketplace — FastAPI backend

A runnable FastAPI skeleton on top of the `../orm` SQLAlchemy models, with
**Alembic** migrations and **Docker Compose** for local development. It
demonstrates the spec's Python/FastAPI/PostgreSQL/Redis stack.

> This is a foundation: catalog/vendor endpoints, health checks, pagination,
> bilingual search, and migration wiring. Auth (JWT/2FA), payments, shipping,
> and the AI services are scoped in the database design and meant to be built
> on this scaffold.

## Layout

```
backend/
├── app/
│   ├── config.py          # env-driven settings (RAF_* vars)
│   ├── db.py              # engine + get_db() session dependency
│   ├── security.py        # bcrypt hashing, JWT, TOTP (2FA)
│   ├── deps.py            # get_current_user + require_permission (RBAC)
│   ├── schemas.py         # Pydantic v2 request/response models
│   ├── main.py            # FastAPI app + router registration
│   └── routers/
│       ├── health.py      # /health, /ready
│       ├── auth.py        # register/login/refresh/me + 2FA
│       ├── products.py    # list/search/get/create + variants/stock/submit
│       ├── moderation.py  # admin product approve/reject/queue
│       ├── taxonomy.py    # category & brand browsing + admin CRUD
│       ├── vendors.py     # list/get/approve vendors
│       ├── cart.py        # view/add/remove cart items
│       ├── orders.py      # checkout, payment confirm, order retrieval
│       ├── ai.py          # product generator, recommendations, assistant
│       ├── shipments.py   # shipment creation + tracking timeline
│       ├── returns.py     # returns, refunds, restock, wallet debit
│       ├── reviews.py     # product reviews + rating recalculation
│       ├── wishlist.py    # customer wishlist
│       ├── addresses.py   # customer address book
│       ├── reports.py     # vendor/platform reporting (view-backed)
│       ├── coupons.py     # marketing: discount codes
│       └── notifications.py  # notification inbox + push devices
│   └── services/
│       ├── ai.py          # pluggable AI provider (stub | anthropic)
│       ├── access.py      # shared vendor-access checks
│       ├── coupons.py     # coupon validation + discount calculation
│       └── notifications.py  # emit notifications on key events
├── alembic/               # migrations (initial applies ../schema.sql)
├── tests/                 # pytest suite (auth, RBAC, orders, AI, shipping, returns, reviews)
├── alembic.ini
├── Dockerfile
└── requirements.txt
```

## Run with Docker (recommended)

```bash
cd RAF_Marketplace_DB
docker compose up --build
# API → http://localhost:8000/docs
```

The `api` container runs `alembic upgrade head` on start, then serves uvicorn.

## Run locally

```bash
cd RAF_Marketplace_DB/backend
pip install -r requirements.txt
cp .env.example .env                 # point RAF_DATABASE_URL at your Postgres

alembic upgrade head                 # create the schema
uvicorn app.main:app --reload        # http://localhost:8000/docs
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness |
| GET | `/ready` | Readiness (checks DB) |
| POST | `/auth/register` | Register a customer (auto-grants `customer` role) |
| POST | `/auth/login` | OAuth2 password login → JWT access + refresh tokens |
| POST | `/auth/refresh` | Exchange a refresh token for new tokens |
| GET | `/auth/me` | Current user (requires Bearer token) |
| POST | `/auth/2fa/setup` | Generate a TOTP secret + `otpauth://` URI |
| POST | `/auth/2fa/enable` · `/auth/2fa/disable` | Turn 2FA on/off (verifies a code) |
| GET | `/categories` · `/brands` | Public taxonomy browsing |
| POST · PUT · DELETE | `/categories` · `/brands` (+ `/{id}`) | Taxonomy admin — requires `catalog.manage` |
| GET | `/products` | Published products; filters: `category_id`, `vendor_id`, `brand_id`, `q`, `min_price`/`max_price`, `in_stock`, `sort` (newest/price_asc/price_desc/rating), pagination |
| GET | `/products/{id}` | Product detail with variants |
| POST | `/products` | Create a draft product — requires `product.create` permission |
| POST | `/products/{id}/variants` | Add a SKU + stock (vendor owner/staff) |
| PUT | `/products/variants/{id}` · `/products/variants/{id}/inventory` | Update price/active, set stock |
| POST | `/products/{id}/submit` | Submit a draft for moderation (needs ≥1 variant) |
| GET · POST | `/products/{id}/images` | List (public) / add a product image (vendor) |
| DELETE | `/products/images/{id}` | Remove a product image (vendor) |
| GET | `/admin/products` | Moderation queue — requires `product.moderate` |
| POST | `/products/{id}/approve` · `/products/{id}/reject` | Moderate — requires `product.moderate` |
| GET | `/vendors` | List vendors (approved by default) |
| POST | `/vendors/apply` | Apply to open a store (creates a pending vendor + wallet) |
| GET | `/vendors/admin/queue` | Vendor approval queue — requires `vendor.approve` |
| GET | `/vendors/{slug}` | Vendor by slug |
| POST | `/vendors/{id}/approve` · `/reject` | Approve (grants owner store access) / reject — `vendor.approve` |
| POST · GET | `/vendors/{id}/payouts` | Request a withdrawal / list (owner/staff/admin) |
| GET | `/admin/payouts` | Payout queue — requires `payout.process` |
| POST | `/payouts/{id}/approve` · `/reject` | Pay / refund a payout — requires `payout.process` |
| GET | `/cart` | View the current user's cart with totals |
| POST | `/cart/items` | Add/accumulate a variant in the cart |
| DELETE | `/cart/items/{variant_id}` | Remove a line from the cart |
| POST | `/orders/checkout` | Turn the cart into an order (+ pending payment) |
| POST | `/orders/{id}/pay/confirm` | Simulate gateway success → deduct stock, credit vendor |
| GET | `/orders` | List the current user's orders |
| GET | `/orders/{id}` | Order detail with items + payment (owner only) |
| POST | `/ai/products/generate` | Generate bilingual title/description/tags/SEO (records an `ai_job`) |
| GET | `/ai/recommendations` | Trending/new product recommendations |
| POST | `/ai/assistant/chat` | Shopping-assistant turn (persists the conversation) |
| POST | `/ai/images/process` | AI image op (bg removal/enhance/optimize) → records an `ai_job` |
| POST | `/ai/forecast/products/{id}` | Demand forecast from recent sales → `ai_forecast` rows |
| GET | `/admin/activity` | Audit log of mutating requests — requires `reports.platform` |
| POST | `/orders/{id}/shipments` | Create a shipment for a vendor's items — requires `order.manage` |
| POST | `/shipments/{id}/events` | Post a tracking event — requires `order.manage` |
| GET | `/shipments/{id}` | Shipment detail + tracking timeline (order owner) |
| GET | `/orders/{id}/shipments` | All shipments for an order (order owner) |
| POST | `/returns` | Request a return for a purchased item (buyer) |
| GET | `/returns` | List the buyer's returns |
| POST | `/returns/{id}/approve` · `/reject` | Resolve a return — requires `order.manage` |
| POST | `/returns/{id}/complete` | Issue refund + restock + debit vendor — requires `order.manage` |
| POST | `/products/{id}/reviews` | Leave a review (one per user; auto verified-purchase flag) |
| GET | `/products/{id}/reviews` | Reviews + rating summary (average, count, star distribution) |
| DELETE | `/reviews/{id}` | Delete your own review (recomputes the rating) |
| GET · POST · DELETE | `/wishlist` · `/wishlist/items` · `/wishlist/items/{product_id}` | Wishlist (idempotent add) |
| GET · POST · PUT · DELETE | `/addresses` ·  `/addresses/{id}` | Address book (single default enforced) |
| GET | `/vendors/{id}/reports/revenue` | Vendor sales/commission/earnings (owner/staff/admin) |
| GET | `/vendors/{id}/reports/low-stock` | Variants at/under their restock threshold |
| GET | `/reports/platform/monthly-revenue` | Platform revenue by month — requires `reports.platform` |
| POST · GET | `/coupons` | Create/list discount codes — create requires `marketing.manage` |
| POST | `/campaigns/generate` | AI-generate a bilingual campaign — requires `marketing.manage` |
| POST · GET · DELETE | `/campaigns` (+ `/{id}`) | Manage marketing campaigns |
| GET | `/notifications` · `/notifications/unread-count` | Notification inbox |
| POST | `/notifications/{id}/read` · `/notifications/read-all` | Mark read |
| POST · DELETE | `/devices` · `/devices/{token}` | Register/unregister a push device |

## Notifications

A bilingual notification inbox (`in_app` by default; `push`/`email`/`sms`
channels available). Notifications are emitted automatically when an order is
confirmed (payment) and when a shipment is delivered. Mobile clients register
push tokens via `/devices` (one row per unique token).

## Marketing & coupons

Coupons (`percent` or `fixed`) can be platform-wide or vendor-scoped. Pass
`coupon_code` to `POST /orders/checkout`: the order validates it (active,
within its window, under any usage limit, meeting `min_order_total`), applies
the discount (a vendor-scoped coupon only discounts that vendor's portion),
sets `discount_total`/`grand_total`, and increments the coupon's `used_count`.

## Reports

Reporting endpoints query the analytics **views** from `../views.sql` (applied
by Alembic migration `0002_reporting_views`). Vendor reports are visible to the
vendor's owner/staff or a platform admin (`reports.platform`); platform-wide
financials require `reports.platform`.

## Reviews & ratings

Any authenticated user can leave **one review per product**; it is flagged
`is_verified_purchase` automatically when the user has a paid order containing
the product. Writing or deleting a review recomputes the product's cached
`rating_avg` / `rating_count`, and the list endpoint returns a summary with the
average and a 1–5 star distribution.

## Returns & refunds

A buyer requests a return (capped at the purchased quantity, only while the
order is confirmed/shipped/delivered). Staff approve/reject; **completing** a
return issues a `refund` for the returned line value, **restocks** inventory,
**debits** the vendor wallet net of commission (a `wallet_transaction`), and
advances the payment to `partially_refunded` / `refunded` (the order flips to
`refunded` once fully covered).

## Shipping & tracking

Carriers (`aramex`/`dhl`/`fedex`/`local`) are modelled as an enum. A shipment
carries a status and an append-only timeline of `shipment_event`s
(status + location + time). Order status follows its shipments automatically:
any shipment in transit moves the order to `shipped`; once all are delivered
the order becomes `delivered`.

## AI layer

The AI endpoints sit behind a **pluggable provider** (`app/services/ai.py`):

- **`stub`** (default) — deterministic, offline, dependency-free; used in dev/CI.
- **`anthropic`** — set `RAF_AI_PROVIDER=anthropic` and `RAF_ANTHROPIC_API_KEY`
  to route generation/chat through the Claude API (`RAF_AI_MODEL`,
  default `claude-sonnet-4-6`). Install the `anthropic` SDK to use it.

Every generation is recorded in `ai_job` (input/output/status/model); the
shopping assistant persists turns to `ai_chat_session` / `ai_chat_message`.
Image operations and demand forecasts are likewise recorded (`ai_job` /
`ai_forecast`). Every mutating request is captured in `activity_log` by an
audit middleware (viewable at `/admin/activity`).

## Checkout & payments

`POST /orders/checkout` builds a **multi-vendor order** from the cart: it
snapshots each line's price/name, computes per-line platform **commission**
from the vendor's rate, **reserves** inventory, empties the cart, and opens a
`pending` payment for the chosen gateway (`thawani`/`omannet`/`stripe`/
`paypal`/`cod`).

`POST /orders/{id}/pay/confirm` simulates a successful gateway callback: it
marks the payment `paid` and the order `confirmed`, **deducts** the reserved
stock, and **credits each vendor's wallet** net of commission with a
`wallet_transaction` ledger entry. It is idempotent on already-paid orders.

## Security

- **Passwords** hashed with bcrypt (`app/security.py`).
- **JWT** access + refresh tokens (PyJWT); `type` claim distinguishes them so a
  refresh token can't be used as an access token and vice-versa.
- **2FA** via TOTP (pyotp) — `/auth/2fa/setup` returns an `otpauth://` URI for
  authenticator apps; once enabled, login requires the current code.
- **RBAC** — `app/deps.py::require_permission(key)` resolves a user's roles →
  permissions and gates privileged routes. Set a strong `RAF_JWT_SECRET`
  (≥32 bytes) in production.

## Tests

```bash
# Point at a DISPOSABLE database — the suite drops & recreates `public`.
export RAF_DATABASE_URL=postgresql+psycopg2://postgres@localhost:5432/raf_test
pytest -v
```

The suite (69 tests) covers auth (registration, login, invalid/duplicate
credentials, `/me`, refresh, 2FA enable + enforcement), RBAC allow/deny, the
full cart → checkout → payment flow (commission, inventory
reservation/deduction, vendor wallet credit, idempotency, owner-scoping), the
AI layer (bilingual generation + `ai_job` persistence, recommendations, chat
persistence + scoping), shipping/tracking (lifecycle, order roll-up, access),
returns/refunds (eligibility caps, approval flow, refund + restock + vendor
wallet debit, partial vs. full refund roll-up), reviews (verified-purchase
flag, rating recalculation, summary/distribution, one-per-user, delete), and
the customer module (wishlist idempotency/removal, address CRUD with
single-default enforcement and owner-scoping), reporting (view-backed vendor
revenue, low-stock, platform monthly revenue with access control), and
marketing (coupon creation permissions/duplicates, percent & fixed discounts
at checkout, min-order and usage-limit enforcement), and notifications
(event emission on order confirmation, mark-read/read-all, owner-scoping,
idempotent device registration), and catalog management (variant/inventory
edits, submit gating, admin approve/reject lifecycle, vendor-access control),
and taxonomy (category/brand CRUD, slug-uniqueness, parent validation, public
browsing, permission gating), and advanced search (brand filter, price range,
in-stock filter, price/rating sorting, invalid-sort rejection), and vendor
onboarding (application, duplicate/slug guards, approval queue, approval
granting the owner store-management access, reject), and payouts (request
holding funds, over-balance rejection, approve, reject refunding the wallet,
access control), AI image processing + demand forecasting (job persistence,
invalid-op handling, vendor-scoped access), and audit logging (mutating
requests recorded, admin-only viewer), and marketing campaigns (AI-generated
bilingual copy, manual create, channel validation, permission gating) — all
green against PostgreSQL 16.

## Continuous integration

`.github/workflows/ci.yml` runs on every push/PR touching `RAF_Marketplace_DB/`:
it spins up PostgreSQL 16, verifies `schema.sql` applies cleanly, runs the
Alembic `upgrade → downgrade → upgrade` round-trip, and executes the full
pytest suite.

## Migrations

```bash
alembic upgrade head          # apply
alembic downgrade base        # tear down
alembic revision --autogenerate -m "add X"   # diff ORM vs DB for new changes
```

The initial migration (`0001_initial_schema`) executes the canonical
`../schema.sql`, keeping the SQL file the single source of truth for structure;
`target_metadata = Base.metadata` enables autogenerate for later changes.

## Verified

- App boots and all 8 routes respond against a seeded PostgreSQL 16 DB
  (list/search/detail/create/404/readiness/OpenAPI).
- Alembic `upgrade head` → 45 tables; `downgrade base` → 0 tables + 0 enum
  types; re-`upgrade` → 45. Full round-trip passes.
