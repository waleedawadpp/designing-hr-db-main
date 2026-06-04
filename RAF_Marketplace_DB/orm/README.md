# RAF Marketplace — SQLAlchemy ORM layer

Typed **SQLAlchemy 2.0** models mirroring `../schema.sql` one-to-one — the
Python data layer for the spec's **FastAPI / PostgreSQL** backend.

Validated: `Base.metadata.create_all()` produces **exactly the same 45 tables**
as `schema.sql` (verified against PostgreSQL 16).

## Install

```bash
pip install -r requirements.txt
```

## Use

```python
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from orm import Base, AppUser, Product, ProductStatus

engine = create_engine("postgresql+psycopg2://user:pass@localhost/raf_marketplace")

# The ENUM types and tables are owned by schema.sql / Alembic. If bootstrapping
# from scratch instead, create the enum types first, then:
# Base.metadata.create_all(engine)

with Session(engine) as s:
    published = s.scalars(
        select(Product).where(Product.status == ProductStatus.published)
    ).all()
```

## FastAPI dependency example

```python
from fastapi import Depends
from sqlalchemy.orm import Session, sessionmaker

SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/products/{product_id}")
def read_product(product_id: int, db: Session = Depends(get_db)):
    return db.get(Product, product_id)
```

## Notes

- PostgreSQL `ENUM` types are bound with `create_type=False`: the SQL migration
  (`schema.sql`) or Alembic owns their lifecycle, so the ORM never tries to
  re-create them.
- `metadata_` maps to the reserved `activity_log.metadata` column (SQLAlchemy
  reserves the `metadata` attribute name on declarative classes).
- Money columns use `Numeric(14, 3)` to match OMR's 3 decimal places.
- For production migrations use **Alembic** with `target_metadata = Base.metadata`.
