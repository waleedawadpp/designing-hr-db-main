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
│   ├── schemas.py         # Pydantic v2 request/response models
│   ├── main.py            # FastAPI app + router registration
│   └── routers/
│       ├── health.py      # /health, /ready
│       ├── products.py    # list/search/get/create products
│       └── vendors.py     # list/get/approve vendors
├── alembic/               # migrations (initial applies ../schema.sql)
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
| GET | `/products` | Published products; filters: `category_id`, `vendor_id`, `q`, pagination |
| GET | `/products/{id}` | Product detail with variants |
| POST | `/products` | Create a draft product |
| GET | `/vendors` | List vendors (approved by default) |
| GET | `/vendors/{slug}` | Vendor by slug |
| POST | `/vendors/{id}/approve` | Admin approval (wire to RBAC before prod) |

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
