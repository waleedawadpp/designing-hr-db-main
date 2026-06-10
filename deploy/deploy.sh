#!/bin/bash
set -e

# ERP Flask Application — Hostinger VPS Deployment Script
# Idempotent: safe to run multiple times for initial setup or updates.

APP_DIR=/home/erp/app
VENV_DIR=/home/erp/venv
DB_NAME=erp_db
DB_USER=erp
REPO_URL=${REPO_URL:-"https://github.com/user/erp.git"}
BRANCH=${BRANCH:-"main"}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== ERP Deployment Script ==="
echo "App directory : $APP_DIR"
echo "Repo URL      : $REPO_URL"
echo "Branch        : $BRANCH"
echo ""

# ── 1. System packages ────────────────────────────────────────────────────────
echo "[1/8] Installing system packages..."
apt-get update -qq
apt-get install -y \
    python3-venv \
    python3-pip \
    python3-dev \
    nginx \
    postgresql \
    postgresql-client \
    libpq-dev \
    build-essential \
    git \
    curl

# ── 2. Create erp system user ─────────────────────────────────────────────────
echo "[2/8] Ensuring 'erp' user exists..."
if ! id -u erp &>/dev/null; then
    useradd -m -s /bin/bash -G www-data erp
    echo "  Created user 'erp'."
else
    echo "  User 'erp' already exists."
    # Ensure erp is in www-data group
    usermod -aG www-data erp
fi

# ── 3. Clone or update repository ─────────────────────────────────────────────
echo "[3/8] Cloning / updating repository..."
if [ -d "$APP_DIR/.git" ]; then
    echo "  Pulling latest changes..."
    sudo -u erp git -C "$APP_DIR" fetch origin
    sudo -u erp git -C "$APP_DIR" checkout "$BRANCH"
    sudo -u erp git -C "$APP_DIR" pull origin "$BRANCH"
else
    echo "  Cloning repository..."
    sudo -u erp git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

# ── 4. Python virtual environment & dependencies ──────────────────────────────
echo "[4/8] Setting up Python virtual environment..."
if [ ! -d "$VENV_DIR" ]; then
    sudo -u erp python3 -m venv "$VENV_DIR"
    echo "  Virtual environment created."
fi

echo "  Installing Python dependencies..."
sudo -u erp "$VENV_DIR/bin/pip" install --upgrade pip -q
sudo -u erp "$VENV_DIR/bin/pip" install -r "$APP_DIR/erp/requirements.txt" -q

# psycopg2-binary may not be in requirements.txt — ensure it is present
sudo -u erp "$VENV_DIR/bin/pip" install psycopg2-binary -q

# ── 5. PostgreSQL database setup ──────────────────────────────────────────────
echo "[5/8] Configuring PostgreSQL..."
systemctl enable postgresql
systemctl start postgresql

# Create DB user if missing
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
    DB_PASSWORD=${DB_PASSWORD:-$(openssl rand -base64 24)}
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
    echo "  Created PostgreSQL user '$DB_USER' with password: $DB_PASSWORD"
    echo "  IMPORTANT: Update the DATABASE_URL in /etc/systemd/system/erp.service with this password."
else
    echo "  PostgreSQL user '$DB_USER' already exists."
fi

# Create database if missing
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
    echo "  Created database '$DB_NAME'."
else
    echo "  Database '$DB_NAME' already exists."
fi

# ── 6. Log directories ────────────────────────────────────────────────────────
echo "[6/8] Creating log directories..."
mkdir -p /var/log/erp
chown erp:www-data /var/log/erp
chmod 0750 /var/log/erp

# ── 7. Install nginx config and systemd service ───────────────────────────────
echo "[7/8] Installing nginx config and systemd service..."

# nginx
cp "$SCRIPT_DIR/nginx.conf" /etc/nginx/sites-available/erp
ln -sf /etc/nginx/sites-available/erp /etc/nginx/sites-enabled/erp
# Remove default site if present (avoid port 80 conflict)
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl reload nginx

# systemd service
cp "$SCRIPT_DIR/erp.service" /etc/systemd/system/erp.service
systemctl daemon-reload
systemctl enable erp

# ── 8. Database migrations and seed ──────────────────────────────────────────
echo "[8/8] Running database migrations..."
cd "$APP_DIR"

# Export minimal env so Flask commands work
export FLASK_APP="erp.app:create_app('production')"
export FLASK_ENV=production
# DATABASE_URL must already be set in environment or erp.service; read from service file as fallback
if [ -z "$DATABASE_URL" ]; then
    DATABASE_URL=$(grep "^Environment=\"DATABASE_URL=" /etc/systemd/system/erp.service \
        | sed 's/Environment="DATABASE_URL=\(.*\)"/\1/')
    export DATABASE_URL
fi

if [ -z "$SECRET_KEY" ]; then
    SECRET_KEY=$(grep "^Environment=\"SECRET_KEY=" /etc/systemd/system/erp.service \
        | sed 's/Environment="SECRET_KEY=\(.*\)"/\1/')
    export SECRET_KEY
fi

sudo -u erp -E "$VENV_DIR/bin/flask" --app "$FLASK_APP" db upgrade 2>/dev/null || \
    sudo -u erp -E "$VENV_DIR/bin/flask" --app "$FLASK_APP" init-db 2>/dev/null || \
    echo "  No db upgrade / init-db command found — skipping."

if sudo -u erp -E "$VENV_DIR/bin/flask" --app "$FLASK_APP" seed 2>/dev/null; then
    echo "  Database seeded."
else
    echo "  No seed command found or seed already run — skipping."
fi

# ── Start the app service ─────────────────────────────────────────────────────
systemctl restart erp
systemctl status erp --no-pager

echo ""
echo "=== Deployment complete ==="
echo "The ERP application is running."
echo "Nginx is proxying HTTP traffic on port 80 to Gunicorn."
echo ""
echo "Post-deployment checklist:"
echo "  1. Edit /etc/systemd/system/erp.service and set a strong SECRET_KEY."
echo "  2. Update DATABASE_URL with the actual PostgreSQL password."
echo "  3. Run: systemctl daemon-reload && systemctl restart erp"
echo "  4. Point your domain at this server and update server_name in /etc/nginx/sites-available/erp."
echo "  5. Consider setting up Let's Encrypt (certbot) for HTTPS."
