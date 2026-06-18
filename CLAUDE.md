# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Repository Overview

This repo contains **three independent projects** that have accumulated in the same directory:

| Directory / Layer | What it is |
|---|---|
| `app/`, `components/`, `context/`, `data/`, `lib/` | **Drinks Store** — an Expo/React Native mobile + web app |
| `RAF_Marketplace_DB/` | **RAF Marketplace** — PostgreSQL schema + FastAPI backend + ORM |
| `SQL_commands/`, `Database_ERD/`, `Document/` | **Legacy HR DB** — original Udacity project (SQL files only, no app) |

The README.md describes the Drinks Store. `README-HR-legacy.md` describes the legacy HR project.

---

## 1. Drinks Store (Expo App)

### Commands

```bash
npm install          # install dependencies
npx expo start       # start dev server (QR code + web/Android/iOS)
npm run web          # web only
npx expo start -c    # clear Metro cache (required after adding new image assets)
npm run gen          # regenerate data/products.ts and placeholder images
npx expo export --platform web   # build dist/ for static hosting
```

### Architecture

The app is a **single-store ordering app** with no backend, no auth, and no payment. Orders are placed by redirecting to WhatsApp.

**Data flow:**
- `data/products.ts` is the sole source of truth for all products. It exports `PRODUCTS: Product[]` and `CATEGORIES`.
- `context/CartContext.tsx` manages cart state and persists it via `AsyncStorage` (mobile) / `localStorage` (web). The context only stores `{id, quantity}` in storage and re-hydrates by looking up full `Product` objects from `PRODUCTS` on load.
- `config.ts` holds all store-level configuration (store name, WhatsApp number, currency, brand color). **Both `config.ts` and `tailwind.config.js` must be updated together when changing the brand color.**
- `lib/whatsapp.ts` builds the `wa.me` order URL; `lib/format.ts` formats prices.

**Routing** is file-based via Expo Router:
- `app/_layout.tsx` — root: loads Cairo fonts, forces RTL globally, wraps everything in `CartProvider`
- `app/index.tsx` — home screen with search, category filter, and responsive product grid
- `app/product/[id].tsx` — product detail
- `app/cart.tsx` — cart + WhatsApp checkout

**RTL/Arabic:** RTL is forced globally in `_layout.tsx` via `I18nManager.forceRTL(true)` and `document.dir="rtl"` for web. All text defaults to `Cairo_400Regular`. Tailwind font classes: `font-cairo`, `font-cairo-semibold`, `font-cairo-bold`, `font-cairo-extrabold`.

**Responsive grid:** `app/index.tsx` calculates `numColumns` from screen width (`Math.floor(width / 240)`, min 2, max 5). Changing `numColumns` forces a FlatList re-render via the `key` prop; filler items pad the last row.

**Adding a product:** Add an entry to `PRODUCTS` in `data/products.ts`. The `image` field **must** be a static `require(...)` literal — Metro cannot resolve dynamic paths. Restart with `npx expo start -c` after adding new image files.

**Prices:** Products with `price: 0` display as "السعر عند الطلب" (price on request) everywhere in the UI.

---

## 2. RAF Marketplace — PostgreSQL Schema + FastAPI Backend

### Commands

```bash
# Apply schema to a local Postgres database
createdb raf_marketplace
psql -d raf_marketplace -f RAF_Marketplace_DB/schema.sql

# Run the full stack locally (PostgreSQL 16 + Redis 7 + API)
cd RAF_Marketplace_DB
docker compose up --build
# API docs: http://localhost:8000/docs

# Run backend tests (requires a running Postgres — use docker compose)
cd RAF_Marketplace_DB/backend
pip install -r requirements.txt
pytest                        # all tests
pytest tests/test_auth.py     # single file
pytest -k "test_login"        # single test by name
```

### Architecture

**Database (`RAF_Marketplace_DB/schema.sql`):** 45 PostgreSQL tables across 13 functional modules. Key design decisions:
- `NUMERIC(14,3)` for all money (OMR uses 3 decimal places).
- `BIGSERIAL` primary keys throughout.
- Bilingual content via `*_ar` (primary) + `*_en` (secondary) column pairs.
- Statuses and fixed domains are PostgreSQL `ENUM` types.
- Soft deletes on `app_user`, `vendor`, `product` via `deleted_at`.
- Append-only `wallet_transaction` and `activity_log` for auditability.
- GIN indexes for full-text search on bilingual product names and tag arrays.

**ORM (`RAF_Marketplace_DB/orm/`):** SQLAlchemy 2.0 models — one-to-one parity with the SQL schema, 45 tables.

**Backend (`RAF_Marketplace_DB/backend/`):** FastAPI app using the ORM models.
- `app/config.py` — `pydantic-settings` reads all config from `RAF_*` env vars.
- `app/db.py` — engine + `get_db()` session dependency.
- `app/security.py` — bcrypt, JWT (access + refresh), TOTP (2FA).
- `app/deps.py` — `get_current_user` + `require_permission` (RBAC guard).
- `app/schemas.py` — all Pydantic v2 request/response models.
- `app/routers/` — one file per domain area (auth, products, orders, AI, etc.).
- `app/services/` — shared business logic (AI provider, coupon validation, notifications, vendor access checks).

**AI layer:** `RAF_AI_PROVIDER=stub` (default) uses a no-op stub. Set to `anthropic` and provide `RAF_ANTHROPIC_API_KEY` to use Claude for product generation, recommendations, the shopping assistant, and forecasting.

**Deploy:** `render.yaml` at the repo root configures a Render Blueprint (Docker web service + managed Postgres). Set `RAF_SEED_ADMIN_EMAIL` / `RAF_SEED_ADMIN_PASSWORD` env vars to create the first admin on first deploy.

---

## 3. Legacy HR Database

SQL-only project in `SQL_commands/` and `Database_ERD/`. No running application. Files:
- `DDL_commands.sql` — schema creation
- `DML_commands.sql` — data population
- `CRUD_commands.sql` — query examples
- `direct_feed.sql` — staging table feed

---

## Key Conventions

- **`require()` paths for images must be static string literals** — Metro bundler resolves them at build time and will fail on dynamic paths.
- When `PRIMARY_COLOR` changes in `config.ts`, also update `brand.DEFAULT` and `brand.dark` in `tailwind.config.js`.
- Cart storage key is `@drinks_store_cart`. The `hydrated` ref in `CartContext` prevents writing stale state before rehydration completes.
- The RAF backend's `conftest.py` sets up an in-memory test database; tests do not need an external Postgres when using the fixture.
