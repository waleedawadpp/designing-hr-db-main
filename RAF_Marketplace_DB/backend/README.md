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
│       ├── products.py    # list/search/get/create products
│       ├── vendors.py     # list/get/approve vendors
│       ├── cart.py        # view/add/remove cart items
│       ├── orders.py      # checkout, payment confirm, order retrieval
│       └── ai.py          # product generator, recommendations, assistant
│   └── services/
│       └── ai.py          # pluggable AI provider (stub | anthropic)
├── alembic/               # migrations (initial applies ../schema.sql)
├── tests/                 # pytest suite (auth, 2FA, RBAC, orders, AI)
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
| GET | `/products` | Published products; filters: `category_id`, `vendor_id`, `q`, pagination |
| GET | `/products/{id}` | Product detail with variants |
| POST | `/products` | Create a draft product — requires `product.create` permission |
| GET | `/vendors` | List vendors (approved by default) |
| GET | `/vendors/{slug}` | Vendor by slug |
| POST | `/vendors/{id}/approve` | Approve a vendor — requires `vendor.approve` permission |
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

## AI layer

The AI endpoints sit behind a **pluggable provider** (`app/services/ai.py`):

- **`stub`** (default) — deterministic, offline, dependency-free; used in dev/CI.
- **`anthropic`** — set `RAF_AI_PROVIDER=anthropic` and `RAF_ANTHROPIC_API_KEY`
  to route generation/chat through the Claude API (`RAF_AI_MODEL`,
  default `claude-sonnet-4-6`). Install the `anthropic` SDK to use it.

Every generation is recorded in `ai_job` (input/output/status/model); the
shopping assistant persists turns to `ai_chat_session` / `ai_chat_message`.

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

The suite (18 tests) covers registration, login, duplicate/invalid
credentials, token-protected `/me`, the refresh flow, 2FA enable +
enforcement, RBAC allow/deny, the full cart → checkout → payment flow
(commission math, inventory reservation/deduction, vendor wallet credit,
idempotent confirmation, owner-scoping), and the AI layer (bilingual product
generation + `ai_job` persistence, recommendations, assistant chat
persistence + owner-scoping) — all green against PostgreSQL 16.

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
