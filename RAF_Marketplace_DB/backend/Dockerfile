# Build context must be the RAF_Marketplace_DB directory (it needs ../orm and
# ../schema.sql). See docker-compose.yml.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app

# System deps for psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# ORM package + canonical SQL (consumed by the initial migration) + app
COPY orm/ ./orm/
COPY schema.sql ./schema.sql
COPY backend/ ./backend/

WORKDIR /app/backend
EXPOSE 8000

# Apply migrations, seed RBAC + admin (idempotent), then serve.
CMD ["sh", "-c", "alembic upgrade head && python -m app.seed_prod && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
