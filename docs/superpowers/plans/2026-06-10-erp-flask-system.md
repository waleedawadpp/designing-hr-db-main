# ERP Flask System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack Arabic ERP web application for an import/storage/distribution company using Python Flask, deployable on Hostinger VPS.

**Architecture:** Flask application factory pattern with Blueprints per module, SQLAlchemy ORM with SQLite (dev) / PostgreSQL (prod), Jinja2 templates with Bootstrap 5 RTL for Arabic UI, and a service layer for business logic decoupled from routes.

**Tech Stack:** Python 3.11, Flask 3.x, Flask-SQLAlchemy, Flask-Login, Flask-Migrate, Flask-WTF, WeasyPrint (PDF), openpyxl (Excel), Bootstrap 5 RTL, Gunicorn (production)

---

## ═══════════════════════════════════════
## (1) بنية المشروع — Project Structure
## ═══════════════════════════════════════

```
erp/
├── app/
│   ├── __init__.py                  # App factory (create_app)
│   ├── extensions.py                # db, login_manager, migrate instances
│   ├── config.py                    # Dev / Prod / Test configs
│   │
│   ├── models/
│   │   ├── __init__.py              # Re-exports all models
│   │   ├── core.py                  # Branch, Department, User, Role, Permission
│   │   ├── hr.py                    # Employee, Contract, Attendance, Leave, Salary, Advance
│   │   ├── accounting.py            # Account (COA), FiscalPeriod, JournalEntry, JournalLine, Voucher, Bank
│   │   ├── inventory.py             # Warehouse, Category, Product, Batch, StockMove, Transfer
│   │   ├── purchasing.py            # Supplier, PurchaseOrder, POItem, ImportCost, GoodsReceipt, GRItem
│   │   ├── sales.py                 # Customer, Quotation, QItem, Invoice, InvoiceItem, Return, ReturnItem
│   │   └── fleet.py                 # Vehicle, Maintenance, Fuel, Route, LoadOrder, LoadItem, Delivery
│   │
│   ├── blueprints/
│   │   ├── auth/          routes.py, forms.py
│   │   ├── dashboard/     routes.py
│   │   ├── branches/      routes.py, forms.py
│   │   ├── hr/            routes.py, forms.py
│   │   ├── accounting/    routes.py, forms.py, reports.py
│   │   ├── inventory/     routes.py, forms.py
│   │   ├── purchasing/    routes.py, forms.py
│   │   ├── sales/         routes.py, forms.py, print_views.py
│   │   ├── fleet/         routes.py, forms.py
│   │   └── reports/       routes.py  (cross-module dashboard)
│   │
│   ├── services/
│   │   ├── accounting_service.py    # Auto journal entry generation
│   │   ├── inventory_service.py     # Stock deduction, reorder alerts
│   │   ├── sales_service.py         # Invoice confirm, credit check
│   │   ├── hr_service.py            # Salary calculation, payroll journal
│   │   └── report_service.py        # Excel/PDF export helpers
│   │
│   ├── templates/
│   │   ├── base.html                # RTL Bootstrap 5 layout + sidebar
│   │   ├── macros/
│   │   │   ├── forms.html           # reusable form field macros
│   │   │   └── tables.html          # sortable table macro
│   │   ├── auth/         login.html, change_password.html
│   │   ├── dashboard/    index.html
│   │   ├── branches/     index.html, form.html, detail.html
│   │   ├── hr/           employees/, attendance/, leaves/, salary/, advances/
│   │   ├── accounting/   coa.html, journal.html, voucher.html, reports/
│   │   ├── inventory/    products/, warehouses/, movements/, transfers/, alerts.html
│   │   ├── purchasing/   suppliers/, po/, receipt/
│   │   ├── sales/        customers/, quotations/, invoices/, returns/, aging.html
│   │   ├── fleet/        vehicles/, routes/, load_orders/, deliveries/
│   │   └── reports/      dashboard.html
│   │
│   └── static/
│       ├── css/custom.css
│       ├── js/
│       │   ├── invoice_editor.js    # Dynamic line items + totals calc
│       │   ├── coa_tree.js          # Collapsible account tree
│       │   └── barcode_scan.js      # Barcode input handler
│       └── img/logo.png
│
├── migrations/                      # Flask-Migrate auto-generated
├── seed/
│   ├── __init__.py
│   ├── coa_seed.py                  # Standard Arabic chart of accounts
│   └── demo_seed.py                 # Demo branches, users, products, customers
├── tests/
│   ├── conftest.py                  # Test app + DB fixtures
│   ├── test_auth.py
│   ├── test_accounting.py
│   ├── test_sales.py
│   └── test_inventory.py
├── docs/superpowers/plans/
├── requirements.txt
├── .env.example
├── run.py                           # flask run (dev)
├── wsgi.py                          # Gunicorn entry point (Hostinger)
└── passenger_wsgi.py                # Hostinger shared hosting fallback
```

---

## ═══════════════════════════════════════
## (2) مخطط قاعدة البيانات — ERD نصي
## ═══════════════════════════════════════

```
┌─────────────────────────────────────────────────────────────────┐
│  CORE                                                            │
├──────────────────┐   ┌──────────────────┐   ┌────────────────── │
│ Branch           │   │ Department       │   │ User              │
│──────────────────│   │──────────────────│   │───────────────────│
│ PK id            │◄──┤ FK branch_id     │   │ PK id             │
│ code (unique)    │   │ name             │   │ username (unique)  │
│ name             │   └──────────────────┘   │ password_hash     │
│ address, phone   │                          │ role (enum)       │
│ is_active        │◄─────────────────────────┤ FK branch_id      │
└──────────────────┘                          │ is_active         │
                                              └───────────────────┘
Role: GENERAL_MANAGER, BRANCH_MANAGER, ACCOUNTANT,
      WAREHOUSE_KEEPER, SALES_STAFF, DRIVER

┌─────────────────────────────────────────────────────────────────┐
│  HR                                                              │
├─────────────────────────────────────────────────────────────────┤
│ Employee         │ Contract            │ Attendance             │
│──────────────────│ ───────────────────│ ──────────────────────  │
│ PK id            │ PK id              │ PK id                   │
│ name, nat_id     │ FK employee_id     │ FK employee_id          │
│ FK branch_id     │ type (FULL/PART)   │ date                    │
│ FK dept_id       │ start/end_date     │ check_in, check_out     │
│ position, email  │ basic_salary       │ status (PRESENT/ABSENT) │
│ hire_date, photo │ allowances (JSON)  │                         │
│ status           │ is_active          │ Leave                   │
│                  │                    │ ──────────────────────  │
│ SalaryPayment    │ Advance            │ PK id                   │
│ ─────────────────│ ───────────────────│ FK employee_id          │
│ PK id            │ PK id              │ type (ANNUAL/SICK/...)  │
│ FK employee_id   │ FK employee_id     │ start/end_date          │
│ period (YYYY-MM) │ amount, date       │ approved_by FK user_id  │
│ basic, allowances│ repaid_amount      │ status                  │
│ deductions, net  │ monthly_deduction  │                         │
│ FK journal_id    │ FK journal_id      │                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  ACCOUNTING                                                      │
├─────────────────────────────────────────────────────────────────┤
│ Account (COA)                    │ FiscalPeriod                 │
│ ─────────────────────────────────│ ─────────────────────────── │
│ PK id                            │ PK id                        │
│ code (e.g. 1101)                 │ name (e.g. "يناير 2026")    │
│ name_ar, name_en                 │ start_date, end_date         │
│ type (ASSET/LIAB/EQUITY/REV/EXP) │ is_closed                    │
│ FK parent_id (self-ref)          │ FK branch_id                 │
│ level (1-5)                      │                              │
│ is_leaf (only leaves get entries)│                              │
│ FK branch_id (NULL=global)       │                              │
│ normal_balance (DEBIT/CREDIT)    │                              │
│                                  │                              │
│ JournalEntry                     │ JournalEntryLine             │
│ ─────────────────────────────────│ ─────────────────────────── │
│ PK id                            │ PK id                        │
│ ref_no (auto sequence)           │ FK entry_id                  │
│ date                             │ FK account_id                │
│ description                      │ debit DECIMAL(15,3)          │
│ source (MANUAL/SALE/PURCHASE/...) │ credit DECIMAL(15,3)        │
│ FK period_id                     │ description                  │
│ FK branch_id                     │                              │
│ is_posted                        │ CONSTRAINT: debit*credit=0   │
│ is_reversed                      │ (one side must be 0)         │
│ FK created_by (user)             │                              │
│                                  │                              │
│ CashVoucher                      │ Bank                         │
│ ─────────────────────────────────│ ─────────────────────────── │
│ PK id                            │ PK id                        │
│ type (RECEIPT/PAYMENT)           │ name, account_no             │
│ date, amount                     │ FK branch_id                 │
│ FK account_id (cash/bank acct)   │ FK account_id (COA)          │
│ party_type (CUSTOMER/SUPPLIER/...) │ current_balance            │
│ party_id                         │                              │
│ FK journal_id                    │                              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  INVENTORY                                                       │
├─────────────────────────────────────────────────────────────────┤
│ Warehouse        │ Category         │ Product                   │
│ ─────────────────│ ─────────────────│ ──────────────────────── │
│ PK id            │ PK id            │ PK id                     │
│ FK branch_id     │ name             │ code (unique)             │
│ name, location   │ FK parent_id     │ barcode                   │
│                  │                  │ name_ar, name_en          │
│                  │                  │ FK category_id            │
│                  │                  │ unit (KG/PCS/BOX/...)     │
│                  │                  │ sale_price, cost_price    │
│                  │                  │ reorder_level             │
│                  │                  │ vat_rate (default 5%)     │
│                  │                  │                           │
│ ProductBatch     │ StockMovement    │ StockTransfer             │
│ ─────────────────│ ─────────────────│ ──────────────────────── │
│ PK id            │ PK id            │ PK id                     │
│ FK product_id    │ FK product_id    │ FK from_warehouse_id      │
│ FK warehouse_id  │ FK batch_id      │ FK to_warehouse_id        │
│ batch_no         │ FK warehouse_id  │ date, status              │
│ expiry_date      │ type (IN/OUT/ADJ)│ FK created_by             │
│ qty_on_hand      │ qty (signed)     │                           │
│ unit_cost        │ reference        │ StockTransferItem         │
│ landed_cost      │ source           │ ─────────────────────── │
│                  │ FK created_by    │ FK transfer_id            │
│                  │                  │ FK product_id, batch_id   │
│                  │                  │ qty                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  PURCHASING                                                      │
├─────────────────────────────────────────────────────────────────┤
│ Supplier         │ PurchaseOrder    │ POItem                    │
│ ─────────────────│ ─────────────────│ ──────────────────────── │
│ PK id            │ PK id            │ PK id                     │
│ name, country    │ ref_no           │ FK po_id                  │
│ contact, email   │ FK supplier_id   │ FK product_id             │
│ FK account_id    │ FK branch_id     │ qty, unit_price           │
│ (payable acct)   │ date, status     │ total_price               │
│ payment_terms    │ currency         │                           │
│                  │ exchange_rate    │ GoodsReceipt              │
│ ImportCost       │ total_amount     │ ─────────────────────── │
│ ─────────────────│                  │ PK id                     │
│ PK id            │                  │ FK po_id                  │
│ FK po_id         │                  │ FK warehouse_id           │
│ cost_type        │                  │ date                      │
│ (SHIPPING/CUSTOMS│                  │ FK journal_id             │
│  CLEARANCE/OTHER)│                  │                           │
│ amount, currency │                  │ GRItem                    │
│ FK account_id    │                  │ ─────────────────────── │
│ (for journal)    │                  │ FK receipt_id             │
│                  │                  │ FK product_id             │
│                  │                  │ FK batch_id (created here)│
│                  │                  │ qty_received, landed_cost │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  SALES                                                           │
├─────────────────────────────────────────────────────────────────┤
│ Customer         │ Quotation        │ QItem                     │
│ ─────────────────│ ─────────────────│ ──────────────────────── │
│ PK id            │ PK id            │ PK id                     │
│ name, type       │ ref_no           │ FK quotation_id           │
│ phone, address   │ FK customer_id   │ FK product_id             │
│ FK branch_id     │ FK branch_id     │ qty, unit_price, discount │
│ credit_limit     │ date, valid_until│                           │
│ FK account_id    │ status           │                           │
│ (receivable)     │ (DRAFT/SENT/     │                           │
│ tax_no           │  CONVERTED/VOID) │                           │
│                  │ FK invoice_id    │                           │
│                  │ (after convert)  │                           │
│                  │                  │                           │
│ SalesInvoice     │ InvoiceItem      │ SalesReturn               │
│ ─────────────────│ ─────────────────│ ──────────────────────── │
│ PK id            │ PK id            │ PK id                     │
│ invoice_no       │ FK invoice_id    │ ref_no                    │
│ (branch prefix + │ FK product_id    │ FK invoice_id             │
│  sequence)       │ FK batch_id      │ date, reason              │
│ FK customer_id   │ qty, unit_price  │ FK journal_id             │
│ FK branch_id     │ discount_pct     │                           │
│ type (CASH/CREDIT│ discount_amt     │ ReturnItem                │
│  /ADVANCE)       │ vat_amount       │ ─────────────────────── │
│ date, due_date   │ line_total       │ FK return_id              │
│ subtotal         │                  │ FK invoice_item_id        │
│ discount_total   │                  │ FK product_id, batch_id   │
│ vat_total        │                  │ qty                       │
│ grand_total      │                  │                           │
│ status           │                  │                           │
│ FK journal_id    │                  │                           │
│ FK period_id     │                  │                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  FLEET                                                           │
├─────────────────────────────────────────────────────────────────┤
│ Vehicle          │ VehicleMaint.    │ VehicleFuel               │
│ ─────────────────│ ─────────────────│ ──────────────────────── │
│ PK id            │ PK id            │ PK id                     │
│ plate_no (unique)│ FK vehicle_id    │ FK vehicle_id             │
│ model, year      │ date, type       │ date, liters, cost        │
│ FK branch_id     │ description, cost│ odometer_km               │
│ FK driver_id     │ next_due_date    │                           │
│ license_expiry   │ FK account_id    │                           │
│ status           │                  │                           │
│                  │                  │                           │
│ Route            │ LoadOrder        │ Delivery                  │
│ ─────────────────│ ─────────────────│ ──────────────────────── │
│ PK id            │ PK id            │ PK id                     │
│ name             │ ref_no           │ FK load_order_id          │
│ FK branch_id     │ FK vehicle_id    │ FK invoice_id             │
│ stops (JSON)     │ FK driver_id     │ status (PENDING/DELIVERED │
│                  │ FK route_id      │  /RETURNED)               │
│                  │ date, status     │ collected_amount          │
│                  │                  │ notes                     │
│                  │ LoadItem         │                           │
│                  │ ─────────────────│                           │
│                  │ FK load_order_id │                           │
│                  │ FK invoice_id    │                           │
│                  │ qty_loaded       │                           │
└─────────────────────────────────────────────────────────────────┘

RELATIONSHIPS SUMMARY:
  Branch ──< Warehouse ──< ProductBatch ──< StockMovement
  Branch ──< Employee ──< SalaryPayment ──► JournalEntry
  Branch ──< SalesInvoice ──< InvoiceItem ──► ProductBatch (stock deduction)
  SalesInvoice ──► JournalEntry (auto-generated)
  PurchaseOrder ──< ImportCost ──► landed_cost on ProductBatch
  Account ──< Account (self-referential tree, unlimited depth)
  JournalEntry ──< JournalEntryLine ──► Account
```

---

## ═══════════════════════════════════════
## (3) خطة التنفيذ — Implementation Plan
## ═══════════════════════════════════════

### PHASE ORDER (موافقة مطلوبة قبل التنفيذ)

```
Phase 1  →  Foundation (project scaffold, config, auth, base layout)
Phase 2  →  Branches & Departments
Phase 3  →  Chart of Accounts (COA) — PRIORITY ★★★
Phase 4  →  Sales & Invoicing — PRIORITY ★★★
Phase 5  →  Inventory (products, warehouses, stock movements)
Phase 6  →  Purchasing & Import Costs (landed cost)
Phase 7  →  HR (employees, attendance, payroll)
Phase 8  →  Fleet & Distribution
Phase 9  →  Reports & Dashboard
Phase 10 →  Deployment (Hostinger VPS: nginx + gunicorn)
```

---

### Task 1 — Project Scaffold & Configuration

**Files:**
- Create: `erp/run.py`
- Create: `erp/wsgi.py`
- Create: `erp/passenger_wsgi.py`
- Create: `erp/app/__init__.py`
- Create: `erp/app/extensions.py`
- Create: `erp/app/config.py`
- Create: `erp/requirements.txt`
- Create: `erp/.env.example`

- [ ] **Step 1: Create requirements.txt**

```txt
Flask==3.0.3
Flask-SQLAlchemy==3.1.1
Flask-Login==0.6.3
Flask-Migrate==4.0.7
Flask-WTF==1.2.1
WTForms==3.1.2
WeasyPrint==62.3
openpyxl==3.1.5
python-dotenv==1.0.1
gunicorn==22.0.0
Pillow==10.4.0
```

- [ ] **Step 2: Create app/config.py**

```python
import os
from dotenv import load_dotenv
load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-change-in-prod')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    WTF_CSRF_ENABLED = True

class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:///erp_dev.db')

class ProductionConfig(Config):
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')  # PostgreSQL on Hostinger

class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    WTF_CSRF_ENABLED = False

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
```

- [ ] **Step 3: Create app/extensions.py**

```python
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_migrate import Migrate
from flask_wtf.csrf import CSRFProtect

db = SQLAlchemy()
login_manager = LoginManager()
migrate = Migrate()
csrf = CSRFProtect()

login_manager.login_view = 'auth.login'
login_manager.login_message = 'يرجى تسجيل الدخول للوصول إلى هذه الصفحة'
login_manager.login_message_category = 'warning'
```

- [ ] **Step 4: Create app/__init__.py (app factory)**

```python
from flask import Flask
from .extensions import db, login_manager, migrate, csrf
from .config import config

def create_app(config_name='default'):
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    db.init_app(app)
    login_manager.init_app(app)
    migrate.init_app(app, db)
    csrf.init_app(app)

    from .blueprints.auth import auth_bp
    from .blueprints.dashboard import dashboard_bp
    from .blueprints.branches import branches_bp
    from .blueprints.hr import hr_bp
    from .blueprints.accounting import accounting_bp
    from .blueprints.inventory import inventory_bp
    from .blueprints.purchasing import purchasing_bp
    from .blueprints.sales import sales_bp
    from .blueprints.fleet import fleet_bp
    from .blueprints.reports import reports_bp

    for bp in [auth_bp, dashboard_bp, branches_bp, hr_bp, accounting_bp,
               inventory_bp, purchasing_bp, sales_bp, fleet_bp, reports_bp]:
        app.register_blueprint(bp)

    return app
```

- [ ] **Step 5: Create run.py and wsgi.py**

```python
# run.py
from app import create_app
app = create_app('development')
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
```

```python
# wsgi.py  (gunicorn entry for Hostinger VPS)
from app import create_app
application = create_app('production')
```

```python
# passenger_wsgi.py  (Hostinger shared hosting cPanel)
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from app import create_app
application = create_app('production')
```

- [ ] **Step 6: Create .env.example**

```
SECRET_KEY=change-this-to-random-string
DATABASE_URL=sqlite:///erp_dev.db
FLASK_ENV=development
COMPANY_NAME=اسم الشركة
COMPANY_LOGO=static/img/logo.png
```

- [ ] **Step 7: Install dependencies and verify**

```bash
cd erp
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -c "from app import create_app; print('OK')"
```

- [ ] **Step 8: Commit**

```bash
git add erp/
git commit -m "feat: scaffold Flask ERP project structure and configuration"
```

---

### Task 2 — Core Models (Branch, User, Auth)

**Files:**
- Create: `erp/app/models/core.py`
- Create: `erp/app/models/__init__.py`
- Create: `erp/app/blueprints/auth/__init__.py`
- Create: `erp/app/blueprints/auth/routes.py`
- Create: `erp/app/blueprints/auth/forms.py`
- Create: `erp/app/templates/base.html`
- Create: `erp/app/templates/auth/login.html`
- Create: `erp/app/static/css/custom.css`

- [ ] **Step 1: Write tests for auth**

```python
# tests/test_auth.py
def test_login_page_loads(client):
    rv = client.get('/auth/login')
    assert rv.status_code == 200
    assert 'تسجيل الدخول' in rv.data.decode('utf-8')

def test_login_valid_user(client, seed_user):
    rv = client.post('/auth/login', data={
        'username': 'admin', 'password': 'admin123'
    }, follow_redirects=True)
    assert rv.status_code == 200
    assert 'لوحة التحكم' in rv.data.decode('utf-8')

def test_login_invalid_password(client, seed_user):
    rv = client.post('/auth/login', data={
        'username': 'admin', 'password': 'wrong'
    }, follow_redirects=True)
    assert 'بيانات الدخول غير صحيحة' in rv.data.decode('utf-8')

def test_logout(client, logged_in_client):
    rv = client.get('/auth/logout', follow_redirects=True)
    assert 'تسجيل الدخول' in rv.data.decode('utf-8')
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_auth.py -v
# Expected: ImportError or 404 — models not defined yet
```

- [ ] **Step 3: Create app/models/core.py**

```python
from datetime import datetime
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from ..extensions import db, login_manager

class Branch(db.Model):
    __tablename__ = 'branches'
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(10), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    address = db.Column(db.String(255))
    phone = db.Column(db.String(20))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    users = db.relationship('User', backref='branch', lazy='dynamic')
    warehouses = db.relationship('Warehouse', backref='branch', lazy='dynamic')

class Department(db.Model):
    __tablename__ = 'departments'
    id = db.Column(db.Integer, primary_key=True)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    branch = db.relationship('Branch', backref='departments')

class UserRole:
    GENERAL_MANAGER = 'general_manager'
    BRANCH_MANAGER = 'branch_manager'
    ACCOUNTANT = 'accountant'
    WAREHOUSE_KEEPER = 'warehouse_keeper'
    SALES_STAFF = 'sales_staff'
    DRIVER = 'driver'

    ALL_ROLES = [GENERAL_MANAGER, BRANCH_MANAGER, ACCOUNTANT,
                 WAREHOUSE_KEEPER, SALES_STAFF, DRIVER]
    LABELS = {
        GENERAL_MANAGER: 'مدير عام',
        BRANCH_MANAGER: 'مدير فرع',
        ACCOUNTANT: 'محاسب',
        WAREHOUSE_KEEPER: 'أمين مخزن',
        SALES_STAFF: 'موظف مبيعات',
        DRIVER: 'سائق',
    }

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(30), nullable=False, default=UserRole.SALES_STAFF)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    @property
    def is_general_manager(self):
        return self.role == UserRole.GENERAL_MANAGER

    def can_access_branch(self, branch_id):
        if self.is_general_manager:
            return True
        return self.branch_id == branch_id

    def role_label(self):
        return UserRole.LABELS.get(self.role, self.role)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))
```

- [ ] **Step 4: Create app/models/__init__.py**

```python
from .core import Branch, Department, User, UserRole
from .accounting import Account, FiscalPeriod, JournalEntry, JournalEntryLine, CashVoucher, Bank
from .inventory import Warehouse, Category, Product, ProductBatch, StockMovement, StockTransfer, StockTransferItem
from .hr import Employee, Contract, Attendance, Leave, SalaryPayment, Advance
from .purchasing import Supplier, PurchaseOrder, POItem, ImportCost, GoodsReceipt, GRItem
from .sales import Customer, Quotation, QuotationItem, SalesInvoice, InvoiceItem, SalesReturn, ReturnItem
from .fleet import Vehicle, VehicleMaintenance, VehicleFuel, Route, LoadOrder, LoadItem, Delivery
```

- [ ] **Step 5: Create auth blueprint and forms**

```python
# app/blueprints/auth/__init__.py
from flask import Blueprint
auth_bp = Blueprint('auth', __name__, url_prefix='/auth')
from . import routes
```

```python
# app/blueprints/auth/forms.py
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, BooleanField, SubmitField
from wtforms.validators import DataRequired

class LoginForm(FlaskForm):
    username = StringField('اسم المستخدم', validators=[DataRequired()])
    password = PasswordField('كلمة المرور', validators=[DataRequired()])
    remember_me = BooleanField('تذكرني')
    submit = SubmitField('دخول')
```

```python
# app/blueprints/auth/routes.py
from flask import render_template, redirect, url_for, flash, request
from flask_login import login_user, logout_user, login_required, current_user
from . import auth_bp
from .forms import LoginForm
from ...models import User

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard.index'))
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(username=form.username.data).first()
        if user and user.is_active and user.check_password(form.password.data):
            login_user(user, remember=form.remember_me.data)
            return redirect(request.args.get('next') or url_for('dashboard.index'))
        flash('بيانات الدخول غير صحيحة', 'danger')
    return render_template('auth/login.html', form=form)

@auth_bp.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('auth.login'))
```

- [ ] **Step 6: Create base.html (Bootstrap 5 RTL, Arabic)**

```html
<!-- app/templates/base.html -->
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{% block title %}نظام ERP{% endblock %}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.rtl.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css">
  <link rel="stylesheet" href="{{ url_for('static', filename='css/custom.css') }}">
  {% block extra_css %}{% endblock %}
</head>
<body>
{% if current_user.is_authenticated %}
<div class="d-flex">
  <!-- Sidebar -->
  <nav class="sidebar bg-dark text-white" style="min-width:220px;min-height:100vh">
    <div class="p-3 border-bottom border-secondary">
      <img src="{{ url_for('static', filename='img/logo.png') }}" height="40" class="me-2" onerror="this.style.display='none'">
      <span class="fw-bold fs-6">نظام ERP</span>
    </div>
    <ul class="nav flex-column p-2">
      <li class="nav-item"><a class="nav-link text-white" href="{{ url_for('dashboard.index') }}"><i class="bi bi-speedometer2 me-2"></i>لوحة التحكم</a></li>
      <li class="nav-item"><a class="nav-link text-white" href="{{ url_for('branches.index') }}"><i class="bi bi-building me-2"></i>الفروع</a></li>
      <li class="nav-item"><a class="nav-link text-white" href="{{ url_for('hr.employees') }}"><i class="bi bi-people me-2"></i>الموارد البشرية</a></li>
      <li class="nav-item"><a class="nav-link text-white" href="{{ url_for('accounting.coa') }}"><i class="bi bi-diagram-3 me-2"></i>شجرة الحسابات</a></li>
      <li class="nav-item"><a class="nav-link text-white" href="{{ url_for('inventory.products') }}"><i class="bi bi-box-seam me-2"></i>المخازن</a></li>
      <li class="nav-item"><a class="nav-link text-white" href="{{ url_for('purchasing.orders') }}"><i class="bi bi-cart me-2"></i>المشتريات</a></li>
      <li class="nav-item"><a class="nav-link text-white" href="{{ url_for('sales.invoices') }}"><i class="bi bi-receipt me-2"></i>المبيعات</a></li>
      <li class="nav-item"><a class="nav-link text-white" href="{{ url_for('fleet.vehicles') }}"><i class="bi bi-truck me-2"></i>الأسطول</a></li>
      <li class="nav-item mt-3 border-top border-secondary pt-2">
        <a class="nav-link text-danger" href="{{ url_for('auth.logout') }}"><i class="bi bi-box-arrow-left me-2"></i>تسجيل الخروج</a>
      </li>
    </ul>
  </nav>
  <!-- Main content -->
  <div class="flex-grow-1">
    <nav class="navbar navbar-light bg-white border-bottom px-3">
      <span class="navbar-text">مرحباً، {{ current_user.full_name }} ({{ current_user.role_label() }})</span>
    </nav>
    <div class="container-fluid p-4">
      {% with messages = get_flashed_messages(with_categories=true) %}
        {% for cat, msg in messages %}
          <div class="alert alert-{{ cat }} alert-dismissible fade show" role="alert">
            {{ msg }}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>
          </div>
        {% endfor %}
      {% endwith %}
      {% block content %}{% endblock %}
    </div>
  </div>
</div>
{% else %}
  {% block auth_content %}{% endblock %}
{% endif %}
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
{% block extra_js %}{% endblock %}
</body>
</html>
```

- [ ] **Step 7: Create auth/login.html**

```html
<!-- app/templates/auth/login.html -->
{% extends 'base.html' %}
{% block auth_content %}
<div class="min-vh-100 d-flex align-items-center justify-content-center bg-light">
  <div class="card shadow" style="width:380px">
    <div class="card-body p-4">
      <h4 class="text-center mb-4">تسجيل الدخول</h4>
      <form method="POST">
        {{ form.hidden_tag() }}
        <div class="mb-3">
          <label class="form-label">{{ form.username.label }}</label>
          {{ form.username(class="form-control", placeholder="اسم المستخدم") }}
        </div>
        <div class="mb-3">
          <label class="form-label">{{ form.password.label }}</label>
          {{ form.password(class="form-control", placeholder="كلمة المرور") }}
        </div>
        <div class="mb-3 form-check">
          {{ form.remember_me(class="form-check-input") }}
          <label class="form-check-label">{{ form.remember_me.label }}</label>
        </div>
        {{ form.submit(class="btn btn-primary w-100") }}
      </form>
    </div>
  </div>
</div>
{% endblock %}
```

- [ ] **Step 8: Create conftest.py for tests**

```python
# tests/conftest.py
import pytest
from app import create_app
from app.extensions import db as _db
from app.models import User, Branch, UserRole

@pytest.fixture(scope='session')
def app():
    app = create_app('testing')
    with app.app_context():
        _db.create_all()
        yield app
        _db.drop_all()

@pytest.fixture(scope='function')
def client(app):
    return app.test_client()

@pytest.fixture(scope='function')
def seed_user(app):
    with app.app_context():
        branch = Branch(code='HQ', name='الفرع الرئيسي')
        _db.session.add(branch)
        _db.session.flush()
        user = User(username='admin', full_name='مدير النظام',
                    role=UserRole.GENERAL_MANAGER, branch_id=branch.id)
        user.set_password('admin123')
        _db.session.add(user)
        _db.session.commit()
        return user

@pytest.fixture(scope='function')
def logged_in_client(client, seed_user):
    client.post('/auth/login', data={'username': 'admin', 'password': 'admin123'})
    return client
```

- [ ] **Step 9: Run tests — expect pass**

```bash
pytest tests/test_auth.py -v
# Expected: 4 passed
```

- [ ] **Step 10: Commit**

```bash
git add erp/
git commit -m "feat: add core models (Branch/User/Auth) with auth blueprint and RTL base template"
```

---

### Task 3 — Chart of Accounts (COA) — شجرة الحسابات ★★★ PRIORITY

**Files:**
- Create: `erp/app/models/accounting.py`
- Create: `erp/app/blueprints/accounting/__init__.py`
- Create: `erp/app/blueprints/accounting/routes.py`
- Create: `erp/app/blueprints/accounting/forms.py`
- Create: `erp/app/templates/accounting/coa.html`
- Create: `erp/app/templates/accounting/account_form.html`
- Create: `erp/app/static/js/coa_tree.js`
- Create: `erp/seed/coa_seed.py`
- Test: `erp/tests/test_accounting.py`

- [ ] **Step 1: Write tests**

```python
# tests/test_accounting.py
def test_coa_tree_loads(logged_in_client):
    rv = logged_in_client.get('/accounting/coa')
    assert rv.status_code == 200
    assert 'شجرة الحسابات' in rv.data.decode('utf-8')

def test_add_account(app, logged_in_client):
    with app.app_context():
        from app.models import Account
        rv = logged_in_client.post('/accounting/accounts/add', data={
            'code': '1101', 'name_ar': 'النقدية', 'type': 'ASSET',
            'parent_id': '', 'normal_balance': 'DEBIT'
        }, follow_redirects=True)
        assert rv.status_code == 200
        assert Account.query.filter_by(code='1101').first() is not None

def test_journal_entry_balanced(app, logged_in_client):
    rv = logged_in_client.post('/accounting/journal/new', data={
        'date': '2026-01-01', 'description': 'قيد اختبار',
        'lines-0-account_id': '1', 'lines-0-debit': '1000', 'lines-0-credit': '0',
        'lines-1-account_id': '2', 'lines-1-debit': '0', 'lines-1-credit': '900',
    }, follow_redirects=True)
    assert 'القيد غير متوازن' in rv.data.decode('utf-8')
```

- [ ] **Step 2: Run tests — verify fail**

```bash
pytest tests/test_accounting.py -v
# Expected: FAIL (models not exist)
```

- [ ] **Step 3: Create app/models/accounting.py**

```python
from datetime import datetime
from ..extensions import db

class AccountType:
    ASSET = 'ASSET'
    LIABILITY = 'LIABILITY'
    EQUITY = 'EQUITY'
    REVENUE = 'REVENUE'
    EXPENSE = 'EXPENSE'
    LABELS = {'ASSET': 'أصول', 'LIABILITY': 'خصوم',
               'EQUITY': 'حقوق ملكية', 'REVENUE': 'إيرادات', 'EXPENSE': 'مصروفات'}

class Account(db.Model):
    __tablename__ = 'accounts'
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(20), unique=True, nullable=False)
    name_ar = db.Column(db.String(150), nullable=False)
    name_en = db.Column(db.String(150))
    type = db.Column(db.String(20), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('accounts.id'))
    level = db.Column(db.Integer, default=1)
    is_leaf = db.Column(db.Boolean, default=True)
    normal_balance = db.Column(db.String(10), default='DEBIT')  # DEBIT or CREDIT
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'))
    is_active = db.Column(db.Boolean, default=True)

    children = db.relationship('Account', backref=db.backref('parent', remote_side=[id]),
                                lazy='dynamic', foreign_keys=[parent_id])
    journal_lines = db.relationship('JournalEntryLine', backref='account', lazy='dynamic')

    def get_balance(self, branch_id=None, from_date=None, to_date=None):
        query = JournalEntryLine.query.join(JournalEntry).filter(
            JournalEntryLine.account_id == self.id,
            JournalEntry.is_posted == True
        )
        if branch_id:
            query = query.filter(JournalEntry.branch_id == branch_id)
        if from_date:
            query = query.filter(JournalEntry.date >= from_date)
        if to_date:
            query = query.filter(JournalEntry.date <= to_date)
        result = query.with_entities(
            db.func.sum(JournalEntryLine.debit),
            db.func.sum(JournalEntryLine.credit)
        ).first()
        total_debit = result[0] or 0
        total_credit = result[1] or 0
        if self.normal_balance == 'DEBIT':
            return total_debit - total_credit
        return total_credit - total_debit

    def get_children_recursive(self):
        result = []
        for child in self.children.order_by(Account.code):
            result.append(child)
            result.extend(child.get_children_recursive())
        return result

class FiscalPeriod(db.Model):
    __tablename__ = 'fiscal_periods'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    is_closed = db.Column(db.Boolean, default=False)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'))

class JournalEntry(db.Model):
    __tablename__ = 'journal_entries'
    id = db.Column(db.Integer, primary_key=True)
    ref_no = db.Column(db.String(30), unique=True)
    date = db.Column(db.Date, nullable=False)
    description = db.Column(db.String(500))
    source = db.Column(db.String(30), default='MANUAL')
    source_ref_id = db.Column(db.Integer)
    period_id = db.Column(db.Integer, db.ForeignKey('fiscal_periods.id'))
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'))
    is_posted = db.Column(db.Boolean, default=False)
    is_reversed = db.Column(db.Boolean, default=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    lines = db.relationship('JournalEntryLine', backref='entry',
                             lazy='dynamic', cascade='all, delete-orphan')

    def total_debit(self):
        return sum(l.debit for l in self.lines)

    def total_credit(self):
        return sum(l.credit for l in self.lines)

    def is_balanced(self):
        return abs(self.total_debit() - self.total_credit()) < 0.001

class JournalEntryLine(db.Model):
    __tablename__ = 'journal_entry_lines'
    id = db.Column(db.Integer, primary_key=True)
    entry_id = db.Column(db.Integer, db.ForeignKey('journal_entries.id'), nullable=False)
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=False)
    debit = db.Column(db.Numeric(15, 3), default=0)
    credit = db.Column(db.Numeric(15, 3), default=0)
    description = db.Column(db.String(255))

class CashVoucher(db.Model):
    __tablename__ = 'cash_vouchers'
    id = db.Column(db.Integer, primary_key=True)
    ref_no = db.Column(db.String(30), unique=True)
    type = db.Column(db.String(10), nullable=False)  # RECEIPT / PAYMENT
    date = db.Column(db.Date, nullable=False)
    amount = db.Column(db.Numeric(15, 3), nullable=False)
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'))
    party_type = db.Column(db.String(20))  # CUSTOMER / SUPPLIER / EMPLOYEE / OTHER
    party_id = db.Column(db.Integer)
    description = db.Column(db.String(500))
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'))
    journal_id = db.Column(db.Integer, db.ForeignKey('journal_entries.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Bank(db.Model):
    __tablename__ = 'banks'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    account_no = db.Column(db.String(50))
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'))
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'))
    current_balance = db.Column(db.Numeric(15, 3), default=0)
```

- [ ] **Step 4: Create COA seed data (standard Arabic chart of accounts)**

```python
# seed/coa_seed.py
COA_DATA = [
    # Level 1: Main categories
    {'code': '1', 'name_ar': 'الأصول', 'type': 'ASSET', 'parent_code': None, 'normal_balance': 'DEBIT'},
    {'code': '2', 'name_ar': 'الخصوم', 'type': 'LIABILITY', 'parent_code': None, 'normal_balance': 'CREDIT'},
    {'code': '3', 'name_ar': 'حقوق الملكية', 'type': 'EQUITY', 'parent_code': None, 'normal_balance': 'CREDIT'},
    {'code': '4', 'name_ar': 'الإيرادات', 'type': 'REVENUE', 'parent_code': None, 'normal_balance': 'CREDIT'},
    {'code': '5', 'name_ar': 'المصروفات', 'type': 'EXPENSE', 'parent_code': None, 'normal_balance': 'DEBIT'},
    # Level 2: Sub-categories
    {'code': '11', 'name_ar': 'الأصول المتداولة', 'type': 'ASSET', 'parent_code': '1', 'normal_balance': 'DEBIT'},
    {'code': '12', 'name_ar': 'الأصول الثابتة', 'type': 'ASSET', 'parent_code': '1', 'normal_balance': 'DEBIT'},
    {'code': '21', 'name_ar': 'الخصوم المتداولة', 'type': 'LIABILITY', 'parent_code': '2', 'normal_balance': 'CREDIT'},
    {'code': '22', 'name_ar': 'الخصوم طويلة الأجل', 'type': 'LIABILITY', 'parent_code': '2', 'normal_balance': 'CREDIT'},
    {'code': '31', 'name_ar': 'رأس المال', 'type': 'EQUITY', 'parent_code': '3', 'normal_balance': 'CREDIT'},
    {'code': '32', 'name_ar': 'الأرباح المحتجزة', 'type': 'EQUITY', 'parent_code': '3', 'normal_balance': 'CREDIT'},
    {'code': '41', 'name_ar': 'إيرادات المبيعات', 'type': 'REVENUE', 'parent_code': '4', 'normal_balance': 'CREDIT'},
    {'code': '51', 'name_ar': 'تكلفة البضاعة المباعة', 'type': 'EXPENSE', 'parent_code': '5', 'normal_balance': 'DEBIT'},
    {'code': '52', 'name_ar': 'المصروفات الإدارية', 'type': 'EXPENSE', 'parent_code': '5', 'normal_balance': 'DEBIT'},
    {'code': '53', 'name_ar': 'مصروفات المبيعات', 'type': 'EXPENSE', 'parent_code': '5', 'normal_balance': 'DEBIT'},
    {'code': '54', 'name_ar': 'المصروفات المالية', 'type': 'EXPENSE', 'parent_code': '5', 'normal_balance': 'DEBIT'},
    # Level 3: Leaf accounts
    {'code': '1101', 'name_ar': 'الصندوق (الخزينة)', 'type': 'ASSET', 'parent_code': '11', 'normal_balance': 'DEBIT'},
    {'code': '1102', 'name_ar': 'البنوك', 'type': 'ASSET', 'parent_code': '11', 'normal_balance': 'DEBIT'},
    {'code': '1103', 'name_ar': 'ذمم مدينة (عملاء)', 'type': 'ASSET', 'parent_code': '11', 'normal_balance': 'DEBIT'},
    {'code': '1104', 'name_ar': 'مخزون بضاعة', 'type': 'ASSET', 'parent_code': '11', 'normal_balance': 'DEBIT'},
    {'code': '1105', 'name_ar': 'مصروفات مدفوعة مقدماً', 'type': 'ASSET', 'parent_code': '11', 'normal_balance': 'DEBIT'},
    {'code': '1106', 'name_ar': 'ضريبة القيمة المضافة المدخلات', 'type': 'ASSET', 'parent_code': '11', 'normal_balance': 'DEBIT'},
    {'code': '1201', 'name_ar': 'أراضي ومباني', 'type': 'ASSET', 'parent_code': '12', 'normal_balance': 'DEBIT'},
    {'code': '1202', 'name_ar': 'آلات ومعدات', 'type': 'ASSET', 'parent_code': '12', 'normal_balance': 'DEBIT'},
    {'code': '1203', 'name_ar': 'سيارات وأسطول', 'type': 'ASSET', 'parent_code': '12', 'normal_balance': 'DEBIT'},
    {'code': '2101', 'name_ar': 'ذمم دائنة (موردون)', 'type': 'LIABILITY', 'parent_code': '21', 'normal_balance': 'CREDIT'},
    {'code': '2102', 'name_ar': 'ضريبة القيمة المضافة المخرجات', 'type': 'LIABILITY', 'parent_code': '21', 'normal_balance': 'CREDIT'},
    {'code': '2103', 'name_ar': 'رواتب مستحقة الدفع', 'type': 'LIABILITY', 'parent_code': '21', 'normal_balance': 'CREDIT'},
    {'code': '2104', 'name_ar': 'تسهيلات بنكية قصيرة الأجل', 'type': 'LIABILITY', 'parent_code': '21', 'normal_balance': 'CREDIT'},
    {'code': '2201', 'name_ar': 'قروض طويلة الأجل', 'type': 'LIABILITY', 'parent_code': '22', 'normal_balance': 'CREDIT'},
    {'code': '3101', 'name_ar': 'رأس مال المساهمين', 'type': 'EQUITY', 'parent_code': '31', 'normal_balance': 'CREDIT'},
    {'code': '3201', 'name_ar': 'أرباح السنوات السابقة', 'type': 'EQUITY', 'parent_code': '32', 'normal_balance': 'CREDIT'},
    {'code': '4101', 'name_ar': 'مبيعات بضاعة', 'type': 'REVENUE', 'parent_code': '41', 'normal_balance': 'CREDIT'},
    {'code': '4102', 'name_ar': 'مردودات المبيعات', 'type': 'REVENUE', 'parent_code': '41', 'normal_balance': 'DEBIT'},
    {'code': '4103', 'name_ar': 'خصم مكتسب', 'type': 'REVENUE', 'parent_code': '41', 'normal_balance': 'CREDIT'},
    {'code': '5101', 'name_ar': 'تكلفة البضاعة المباعة', 'type': 'EXPENSE', 'parent_code': '51', 'normal_balance': 'DEBIT'},
    {'code': '5201', 'name_ar': 'رواتب إدارية', 'type': 'EXPENSE', 'parent_code': '52', 'normal_balance': 'DEBIT'},
    {'code': '5202', 'name_ar': 'إيجار مكاتب', 'type': 'EXPENSE', 'parent_code': '52', 'normal_balance': 'DEBIT'},
    {'code': '5203', 'name_ar': 'مصروفات عمومية وإدارية', 'type': 'EXPENSE', 'parent_code': '52', 'normal_balance': 'DEBIT'},
    {'code': '5301', 'name_ar': 'رواتب مبيعات وتوزيع', 'type': 'EXPENSE', 'parent_code': '53', 'normal_balance': 'DEBIT'},
    {'code': '5302', 'name_ar': 'مصروفات شحن ونقل', 'type': 'EXPENSE', 'parent_code': '53', 'normal_balance': 'DEBIT'},
    {'code': '5303', 'name_ar': 'مصروفات إعلان وتسويق', 'type': 'EXPENSE', 'parent_code': '53', 'normal_balance': 'DEBIT'},
    {'code': '5401', 'name_ar': 'فوائد بنكية مدفوعة', 'type': 'EXPENSE', 'parent_code': '54', 'normal_balance': 'DEBIT'},
    {'code': '5402', 'name_ar': 'مصروفات جمارك وتخليص', 'type': 'EXPENSE', 'parent_code': '54', 'normal_balance': 'DEBIT'},
]

def seed_coa(db, Account):
    code_to_id = {}
    for item in COA_DATA:
        parent_id = code_to_id.get(item['parent_code']) if item['parent_code'] else None
        level = len(item['code']) // 2 if len(item['code']) > 1 else 1
        is_leaf = not any(
            d['parent_code'] == item['code'] for d in COA_DATA
        )
        acc = Account(
            code=item['code'],
            name_ar=item['name_ar'],
            type=item['type'],
            parent_id=parent_id,
            level=level,
            is_leaf=is_leaf,
            normal_balance=item['normal_balance']
        )
        db.session.add(acc)
        db.session.flush()
        code_to_id[item['code']] = acc.id
    db.session.commit()
    print(f"✅ Seeded {len(COA_DATA)} accounts")
```

- [ ] **Step 5: Create accounting blueprint routes (COA CRUD + journal)**

```python
# app/blueprints/accounting/routes.py
from flask import render_template, redirect, url_for, flash, request, jsonify
from flask_login import login_required, current_user
from . import accounting_bp
from ...models import Account, JournalEntry, JournalEntryLine, FiscalPeriod
from ...extensions import db
from functools import wraps

def accountant_required(f):
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        from ...models import UserRole
        if current_user.role not in [UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT]:
            flash('ليس لديك صلاحية الوصول', 'danger')
            return redirect(url_for('dashboard.index'))
        return f(*args, **kwargs)
    return decorated

@accounting_bp.route('/coa')
@login_required
def coa():
    root_accounts = Account.query.filter_by(parent_id=None).order_by(Account.code).all()
    return render_template('accounting/coa.html', roots=root_accounts)

@accounting_bp.route('/accounts/add', methods=['GET', 'POST'])
@accountant_required
def add_account():
    from .forms import AccountForm
    form = AccountForm()
    form.parent_id.choices = [('', '— حساب رئيسي —')] + [
        (a.id, f"{a.code} - {a.name_ar}")
        for a in Account.query.filter_by(is_leaf=False).order_by(Account.code).all()
    ]
    if form.validate_on_submit():
        parent = Account.query.get(form.parent_id.data) if form.parent_id.data else None
        if parent:
            parent.is_leaf = False
        acc = Account(
            code=form.code.data,
            name_ar=form.name_ar.data,
            name_en=form.name_en.data,
            type=form.type.data,
            parent_id=parent.id if parent else None,
            level=(parent.level + 1) if parent else 1,
            normal_balance=form.normal_balance.data,
            is_leaf=True
        )
        db.session.add(acc)
        db.session.commit()
        flash('تم إضافة الحساب بنجاح', 'success')
        return redirect(url_for('accounting.coa'))
    return render_template('accounting/account_form.html', form=form, title='إضافة حساب')

@accounting_bp.route('/journal/new', methods=['GET', 'POST'])
@accountant_required
def new_journal():
    from .forms import JournalEntryForm
    form = JournalEntryForm()
    if request.method == 'POST':
        lines_data = _parse_journal_lines(request.form)
        total_debit = sum(l['debit'] for l in lines_data)
        total_credit = sum(l['credit'] for l in lines_data)
        if abs(total_debit - total_credit) > 0.001:
            flash('القيد غير متوازن: مجموع المدين يجب أن يساوي مجموع الدائن', 'danger')
            return render_template('accounting/journal_form.html', form=form)
        entry = JournalEntry(
            date=form.date.data,
            description=form.description.data,
            source='MANUAL',
            branch_id=current_user.branch_id,
            created_by=current_user.id
        )
        db.session.add(entry)
        db.session.flush()
        _generate_ref_no(entry)
        for l in lines_data:
            line = JournalEntryLine(
                entry_id=entry.id,
                account_id=l['account_id'],
                debit=l['debit'],
                credit=l['credit'],
                description=l.get('description', '')
            )
            db.session.add(line)
        db.session.commit()
        flash('تم حفظ القيد اليومي بنجاح', 'success')
        return redirect(url_for('accounting.coa'))
    return render_template('accounting/journal_form.html', form=form)

def _parse_journal_lines(form_data):
    lines = []
    i = 0
    while f'lines-{i}-account_id' in form_data:
        acc_id = form_data.get(f'lines-{i}-account_id')
        debit = float(form_data.get(f'lines-{i}-debit') or 0)
        credit = float(form_data.get(f'lines-{i}-credit') or 0)
        if acc_id and (debit or credit):
            lines.append({'account_id': int(acc_id), 'debit': debit, 'credit': credit,
                          'description': form_data.get(f'lines-{i}-description', '')})
        i += 1
    return lines

def _generate_ref_no(entry):
    from datetime import date
    year = date.today().year
    count = JournalEntry.query.filter(
        db.func.extract('year', JournalEntry.date) == year
    ).count()
    entry.ref_no = f"JE-{year}-{count:05d}"
```

- [ ] **Step 6: Create COA tree template with collapsible tree**

```html
<!-- app/templates/accounting/coa.html -->
{% extends 'base.html' %}
{% block title %}شجرة الحسابات{% endblock %}
{% block content %}
<div class="d-flex justify-content-between align-items-center mb-3">
  <h4><i class="bi bi-diagram-3"></i> شجرة الحسابات</h4>
  <a href="{{ url_for('accounting.add_account') }}" class="btn btn-primary btn-sm">
    <i class="bi bi-plus-circle"></i> إضافة حساب
  </a>
</div>
<div class="card">
  <div class="card-body p-2">
    <div id="coa-tree">
      {% macro render_account(acc, depth=0) %}
      <div class="coa-node" style="padding-right: {{ depth * 20 }}px">
        <div class="d-flex align-items-center py-1 border-bottom">
          {% if not acc.is_leaf %}
            <button class="btn btn-sm btn-link p-0 me-2 toggle-btn" onclick="toggleChildren(this)">
              <i class="bi bi-chevron-down"></i>
            </button>
          {% else %}
            <span class="me-4"></span>
          {% endif %}
          <span class="badge bg-secondary me-2">{{ acc.code }}</span>
          <span class="flex-grow-1">{{ acc.name_ar }}</span>
          <span class="badge {% if acc.type == 'ASSET' %}bg-primary{% elif acc.type == 'LIABILITY' %}bg-warning text-dark{% elif acc.type == 'EQUITY' %}bg-success{% elif acc.type == 'REVENUE' %}bg-info text-dark{% else %}bg-danger{% endif %} me-2">
            {{ {'ASSET':'أصول','LIABILITY':'خصوم','EQUITY':'حقوق ملكية','REVENUE':'إيرادات','EXPENSE':'مصروفات'}[acc.type] }}
          </span>
        </div>
        {% if not acc.is_leaf %}
        <div class="children-container">
          {% for child in acc.children.order_by() %}
            {{ render_account(child, depth + 1) }}
          {% endfor %}
        </div>
        {% endif %}
      </div>
      {% endmacro %}
      {% for root in roots %}
        {{ render_account(root) }}
      {% endfor %}
    </div>
  </div>
</div>
{% endblock %}
{% block extra_js %}
<script>
function toggleChildren(btn) {
  const container = btn.closest('.coa-node').querySelector('.children-container');
  const icon = btn.querySelector('i');
  if (container) {
    container.style.display = container.style.display === 'none' ? '' : 'none';
    icon.classList.toggle('bi-chevron-down');
    icon.classList.toggle('bi-chevron-left');
  }
}
</script>
{% endblock %}
```

- [ ] **Step 7: Run tests — expect pass**

```bash
pytest tests/test_accounting.py -v
# Expected: 3 passed
```

- [ ] **Step 8: Run COA seed**

```bash
cd erp && python -c "
from app import create_app; from app.extensions import db
from app.models import Account; from seed.coa_seed import seed_coa
app = create_app(); 
with app.app_context(): db.create_all(); seed_coa(db, Account)
"
```

- [ ] **Step 9: Commit**

```bash
git commit -m "feat: add Chart of Accounts model, routes, tree view, and standard Arabic COA seed data"
```

---

### Task 4 — Sales & Invoicing ★★★ PRIORITY

**Files:**
- Create: `erp/app/models/sales.py`
- Create: `erp/app/blueprints/sales/__init__.py`
- Create: `erp/app/blueprints/sales/routes.py`
- Create: `erp/app/blueprints/sales/forms.py`
- Create: `erp/app/templates/sales/invoices/index.html`
- Create: `erp/app/templates/sales/invoices/form.html`
- Create: `erp/app/templates/sales/invoices/print.html`
- Create: `erp/app/templates/sales/customers/index.html`
- Create: `erp/app/templates/sales/customers/form.html`
- Create: `erp/app/services/sales_service.py`
- Create: `erp/app/static/js/invoice_editor.js`
- Test: `erp/tests/test_sales.py`

- [ ] **Step 1: Write tests**

```python
# tests/test_sales.py
def test_invoice_list_loads(logged_in_client):
    rv = logged_in_client.get('/sales/invoices/')
    assert rv.status_code == 200

def test_create_invoice_deducts_stock(app, logged_in_client, seed_inventory):
    """Confirming an invoice deducts the correct qty from ProductBatch."""
    with app.app_context():
        from app.models import ProductBatch
        batch = ProductBatch.query.first()
        initial_qty = batch.qty_on_hand
        rv = logged_in_client.post('/sales/invoices/confirm/1', follow_redirects=True)
        batch = ProductBatch.query.get(batch.id)
        assert batch.qty_on_hand < initial_qty

def test_credit_limit_warning(app, logged_in_client, seed_customer_over_limit):
    rv = logged_in_client.get('/sales/customers/1/statement')
    assert 'تجاوز الحد الائتماني' in rv.data.decode('utf-8')

def test_vat_calculation(app, logged_in_client):
    """5% VAT is applied correctly on invoice total."""
    with app.app_context():
        from app.services.sales_service import calculate_invoice_totals
        items = [{'qty': 10, 'unit_price': 100, 'discount_pct': 0, 'vat_rate': 5}]
        result = calculate_invoice_totals(items, invoice_discount=0)
        assert result['vat_total'] == 50.0  # 5% of 1000
        assert result['grand_total'] == 1050.0
```

- [ ] **Step 2: Run tests — verify fail**

```bash
pytest tests/test_sales.py -v
# Expected: FAIL (models not exist)
```

- [ ] **Step 3: Create app/models/sales.py**

```python
from datetime import datetime
from ..extensions import db

class InvoiceType:
    CASH = 'CASH'
    CREDIT = 'CREDIT'
    ADVANCE = 'ADVANCE'
    LABELS = {'CASH': 'نقدي', 'CREDIT': 'آجل', 'ADVANCE': 'دفعة مقدمة'}

class InvoiceStatus:
    DRAFT = 'DRAFT'
    CONFIRMED = 'CONFIRMED'
    PAID = 'PAID'
    PARTIAL = 'PARTIAL'
    CANCELLED = 'CANCELLED'
    LABELS = {'DRAFT': 'مسودة', 'CONFIRMED': 'مؤكد', 'PAID': 'مدفوع',
               'PARTIAL': 'مدفوع جزئياً', 'CANCELLED': 'ملغي'}

class Customer(db.Model):
    __tablename__ = 'customers'
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(20), unique=True)
    name = db.Column(db.String(150), nullable=False)
    type = db.Column(db.String(20), default='RETAIL')  # RETAIL / WHOLESALE
    phone = db.Column(db.String(20))
    address = db.Column(db.String(255))
    tax_no = db.Column(db.String(50))
    credit_limit = db.Column(db.Numeric(15, 3), default=0)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'))
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    invoices = db.relationship('SalesInvoice', backref='customer', lazy='dynamic')

    def outstanding_balance(self):
        from sqlalchemy import func
        result = db.session.query(
            func.sum(SalesInvoice.grand_total) - func.sum(SalesInvoice.amount_paid)
        ).filter(
            SalesInvoice.customer_id == self.id,
            SalesInvoice.type == InvoiceType.CREDIT,
            SalesInvoice.status.in_([InvoiceStatus.CONFIRMED, InvoiceStatus.PARTIAL])
        ).scalar()
        return float(result or 0)

    def is_over_credit_limit(self):
        if self.credit_limit <= 0:
            return False
        return self.outstanding_balance() > float(self.credit_limit)

class Quotation(db.Model):
    __tablename__ = 'quotations'
    id = db.Column(db.Integer, primary_key=True)
    ref_no = db.Column(db.String(30), unique=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'))
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'))
    date = db.Column(db.Date, nullable=False)
    valid_until = db.Column(db.Date)
    status = db.Column(db.String(20), default='DRAFT')
    invoice_id = db.Column(db.Integer, db.ForeignKey('sales_invoices.id'))
    notes = db.Column(db.Text)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    items = db.relationship('QuotationItem', backref='quotation',
                             lazy='dynamic', cascade='all, delete-orphan')

class QuotationItem(db.Model):
    __tablename__ = 'quotation_items'
    id = db.Column(db.Integer, primary_key=True)
    quotation_id = db.Column(db.Integer, db.ForeignKey('quotations.id'))
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'))
    qty = db.Column(db.Numeric(15, 3), nullable=False)
    unit_price = db.Column(db.Numeric(15, 3), nullable=False)
    discount_pct = db.Column(db.Numeric(5, 2), default=0)

class SalesInvoice(db.Model):
    __tablename__ = 'sales_invoices'
    id = db.Column(db.Integer, primary_key=True)
    invoice_no = db.Column(db.String(30), unique=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=False)
    type = db.Column(db.String(10), nullable=False, default=InvoiceType.CASH)
    date = db.Column(db.Date, nullable=False)
    due_date = db.Column(db.Date)
    subtotal = db.Column(db.Numeric(15, 3), default=0)
    discount_total = db.Column(db.Numeric(15, 3), default=0)
    vat_total = db.Column(db.Numeric(15, 3), default=0)
    grand_total = db.Column(db.Numeric(15, 3), default=0)
    amount_paid = db.Column(db.Numeric(15, 3), default=0)
    status = db.Column(db.String(20), default=InvoiceStatus.DRAFT)
    journal_id = db.Column(db.Integer, db.ForeignKey('journal_entries.id'))
    notes = db.Column(db.Text)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    items = db.relationship('InvoiceItem', backref='invoice',
                             lazy='dynamic', cascade='all, delete-orphan')
    returns = db.relationship('SalesReturn', backref='original_invoice', lazy='dynamic')

class InvoiceItem(db.Model):
    __tablename__ = 'invoice_items'
    id = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey('sales_invoices.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    batch_id = db.Column(db.Integer, db.ForeignKey('product_batches.id'))
    qty = db.Column(db.Numeric(15, 3), nullable=False)
    unit_price = db.Column(db.Numeric(15, 3), nullable=False)
    discount_pct = db.Column(db.Numeric(5, 2), default=0)
    discount_amt = db.Column(db.Numeric(15, 3), default=0)
    vat_rate = db.Column(db.Numeric(5, 2), default=5)
    vat_amount = db.Column(db.Numeric(15, 3), default=0)
    line_total = db.Column(db.Numeric(15, 3), default=0)

class SalesReturn(db.Model):
    __tablename__ = 'sales_returns'
    id = db.Column(db.Integer, primary_key=True)
    ref_no = db.Column(db.String(30), unique=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey('sales_invoices.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    reason = db.Column(db.String(500))
    journal_id = db.Column(db.Integer, db.ForeignKey('journal_entries.id'))
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    items = db.relationship('ReturnItem', backref='sales_return',
                             lazy='dynamic', cascade='all, delete-orphan')

class ReturnItem(db.Model):
    __tablename__ = 'return_items'
    id = db.Column(db.Integer, primary_key=True)
    return_id = db.Column(db.Integer, db.ForeignKey('sales_returns.id'))
    invoice_item_id = db.Column(db.Integer, db.ForeignKey('invoice_items.id'))
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'))
    batch_id = db.Column(db.Integer, db.ForeignKey('product_batches.id'))
    qty = db.Column(db.Numeric(15, 3), nullable=False)
```

- [ ] **Step 4: Create sales_service.py**

```python
# app/services/sales_service.py
from decimal import Decimal
from ..extensions import db
from ..models.sales import SalesInvoice, InvoiceItem, InvoiceStatus, InvoiceType
from ..models.inventory import ProductBatch, StockMovement
from .accounting_service import create_sales_journal_entry

VAT_RATE = Decimal('5')

def calculate_invoice_totals(items: list, invoice_discount: float = 0) -> dict:
    subtotal = Decimal('0')
    total_discount = Decimal('0')
    vat_total = Decimal('0')
    for item in items:
        qty = Decimal(str(item['qty']))
        price = Decimal(str(item['unit_price']))
        disc_pct = Decimal(str(item.get('discount_pct', 0)))
        vat_rate = Decimal(str(item.get('vat_rate', 5)))
        line_before_disc = qty * price
        line_disc = line_before_disc * disc_pct / 100
        line_after_disc = line_before_disc - line_disc
        line_vat = line_after_disc * vat_rate / 100
        subtotal += line_before_disc
        total_discount += line_disc
        vat_total += line_vat
    inv_disc = Decimal(str(invoice_discount))
    grand_total = subtotal - total_discount - inv_disc + vat_total
    return {
        'subtotal': float(subtotal),
        'discount_total': float(total_discount + inv_disc),
        'vat_total': float(vat_total),
        'grand_total': float(grand_total),
    }

def confirm_invoice(invoice_id: int, allow_negative_stock: bool = False):
    invoice = SalesInvoice.query.get_or_404(invoice_id)
    if invoice.status != InvoiceStatus.DRAFT:
        raise ValueError('الفاتورة مؤكدة مسبقاً')
    for item in invoice.items:
        batch = ProductBatch.query.get(item.batch_id) if item.batch_id else \
            ProductBatch.query.filter_by(product_id=item.product_id).first()
        if not batch:
            raise ValueError(f'لا توجد دفعة متاحة للصنف {item.product_id}')
        if not allow_negative_stock and batch.qty_on_hand < float(item.qty):
            raise ValueError(f'الكمية المطلوبة ({item.qty}) تتجاوز المتاح ({batch.qty_on_hand})')
        batch.qty_on_hand -= float(item.qty)
        move = StockMovement(
            product_id=item.product_id,
            batch_id=batch.id,
            warehouse_id=batch.warehouse_id,
            type='OUT',
            qty=-float(item.qty),
            reference=invoice.invoice_no,
            source='SALE'
        )
        db.session.add(move)
    journal = create_sales_journal_entry(invoice)
    invoice.journal_id = journal.id
    invoice.status = InvoiceStatus.CONFIRMED
    db.session.commit()
    return invoice

def convert_quotation_to_invoice(quotation_id: int, invoice_type: str, branch_id: int, user_id: int):
    from ..models.sales import Quotation, QuotationItem, SalesInvoice, InvoiceItem
    from datetime import date
    q = Quotation.query.get_or_404(quotation_id)
    invoice = SalesInvoice(
        customer_id=q.customer_id,
        branch_id=branch_id,
        type=invoice_type,
        date=date.today(),
        created_by=user_id
    )
    db.session.add(invoice)
    db.session.flush()
    _assign_invoice_no(invoice)
    for qi in q.items:
        ii = InvoiceItem(
            invoice_id=invoice.id,
            product_id=qi.product_id,
            qty=qi.qty,
            unit_price=qi.unit_price,
            discount_pct=qi.discount_pct,
            vat_rate=VAT_RATE
        )
        db.session.add(ii)
    recalculate_invoice(invoice)
    q.status = 'CONVERTED'
    q.invoice_id = invoice.id
    db.session.commit()
    return invoice

def recalculate_invoice(invoice: SalesInvoice):
    items_data = []
    for item in invoice.items:
        items_data.append({'qty': item.qty, 'unit_price': item.unit_price,
                           'discount_pct': item.discount_pct, 'vat_rate': item.vat_rate})
    totals = calculate_invoice_totals(items_data)
    invoice.subtotal = totals['subtotal']
    invoice.discount_total = totals['discount_total']
    invoice.vat_total = totals['vat_total']
    invoice.grand_total = totals['grand_total']

def _assign_invoice_no(invoice: SalesInvoice):
    from ..models.core import Branch
    from datetime import date
    branch = Branch.query.get(invoice.branch_id)
    year = date.today().year
    count = SalesInvoice.query.filter(
        SalesInvoice.branch_id == invoice.branch_id,
        db.func.extract('year', SalesInvoice.date) == year
    ).count()
    invoice.invoice_no = f"{branch.code}-INV-{year}-{count + 1:05d}"
```

- [ ] **Step 5: Create invoice form template (with dynamic line items)**

The invoice form must:
- Search products by name or barcode (AJAX)
- Add/remove line items dynamically
- Auto-calculate subtotal, discount, VAT, grand total on each change

```html
<!-- app/templates/sales/invoices/form.html -->
{% extends 'base.html' %}
{% block title %}إصدار فاتورة بيع{% endblock %}
{% block content %}
<h4 class="mb-3"><i class="bi bi-receipt"></i> إصدار فاتورة بيع</h4>
<form method="POST" id="invoice-form">
  {{ form.hidden_tag() }}
  <div class="row g-3 mb-3">
    <div class="col-md-4">
      <label class="form-label">العميل</label>
      <select name="customer_id" class="form-select" required>
        {% for c in customers %}
          <option value="{{ c.id }}">{{ c.name }}</option>
        {% endfor %}
      </select>
    </div>
    <div class="col-md-2">
      <label class="form-label">نوع الفاتورة</label>
      <select name="invoice_type" class="form-select">
        <option value="CASH">نقدي</option>
        <option value="CREDIT">آجل</option>
        <option value="ADVANCE">دفعة مقدمة</option>
      </select>
    </div>
    <div class="col-md-2">
      <label class="form-label">التاريخ</label>
      <input type="date" name="date" class="form-control" required value="{{ today }}">
    </div>
    <div class="col-md-2">
      <label class="form-label">تاريخ الاستحقاق</label>
      <input type="date" name="due_date" class="form-control">
    </div>
  </div>
  <!-- Product search bar -->
  <div class="mb-2 d-flex gap-2">
    <input type="text" id="product-search" class="form-control" placeholder="ابحث عن صنف بالاسم أو الباركود..." style="max-width:400px">
    <button type="button" class="btn btn-outline-secondary" onclick="addProductRow()">
      <i class="bi bi-plus-circle"></i> إضافة صنف
    </button>
  </div>
  <!-- Invoice Lines Table -->
  <table class="table table-bordered table-sm" id="invoice-lines">
    <thead class="table-light">
      <tr>
        <th>الصنف</th><th>الكمية</th><th>سعر الوحدة</th>
        <th>خصم %</th><th>ضريبة %</th><th>الإجمالي</th><th></th>
      </tr>
    </thead>
    <tbody id="lines-body">
    </tbody>
  </table>
  <!-- Totals -->
  <div class="row justify-content-end">
    <div class="col-md-4">
      <table class="table table-sm">
        <tr><td>المجموع قبل الضريبة</td><td id="subtotal" class="text-end fw-bold">0.000</td></tr>
        <tr><td>إجمالي الخصم</td><td id="discount-total" class="text-end text-danger">0.000</td></tr>
        <tr><td>ضريبة القيمة المضافة (5%)</td><td id="vat-total" class="text-end">0.000</td></tr>
        <tr class="table-primary"><td><strong>الإجمالي النهائي</strong></td>
            <td id="grand-total" class="text-end fw-bold fs-5">0.000</td></tr>
      </table>
    </div>
  </div>
  <input type="hidden" name="lines_json" id="lines-json">
  <div class="d-flex gap-2">
    <button type="submit" name="action" value="save_draft" class="btn btn-secondary">
      <i class="bi bi-save"></i> حفظ كمسودة
    </button>
    <button type="submit" name="action" value="confirm" class="btn btn-success">
      <i class="bi bi-check-circle"></i> تأكيد وخصم من المخزون
    </button>
  </div>
</form>
{% endblock %}
{% block extra_js %}
<script>
const products = {{ products_json | safe }};
let lineCount = 0;

function addProductRow(product = null) {
  const body = document.getElementById('lines-body');
  const idx = lineCount++;
  const row = document.createElement('tr');
  row.id = `line-${idx}`;
  row.innerHTML = `
    <td>
      <select class="form-select form-select-sm product-sel" onchange="updateLine(${idx})" name="line_product_${idx}">
        <option value="">-- اختر صنف --</option>
        ${products.map(p => `<option value="${p.id}" data-price="${p.sale_price}" data-vat="${p.vat_rate}"
          ${product && product.id == p.id ? 'selected' : ''}>${p.name_ar}</option>`).join('')}
      </select>
    </td>
    <td><input type="number" class="form-control form-control-sm qty" step="0.001" value="1" oninput="calcLine(${idx})"></td>
    <td><input type="number" class="form-control form-control-sm price" step="0.001" value="${product ? product.sale_price : 0}" oninput="calcLine(${idx})"></td>
    <td><input type="number" class="form-control form-control-sm disc" step="0.01" value="0" max="100" oninput="calcLine(${idx})"></td>
    <td><input type="number" class="form-control form-control-sm vat-rate" step="0.01" value="${product ? product.vat_rate : 5}" oninput="calcLine(${idx})"></td>
    <td class="line-total text-end fw-bold">0.000</td>
    <td><button type="button" class="btn btn-sm btn-danger" onclick="removeLine(${idx})"><i class="bi bi-trash"></i></button></td>
  `;
  body.appendChild(row);
  if (product) { updateLine(idx); }
}

function updateLine(idx) {
  const row = document.getElementById(`line-${idx}`);
  const sel = row.querySelector('.product-sel');
  const opt = sel.options[sel.selectedIndex];
  if (opt.value) {
    row.querySelector('.price').value = opt.dataset.price || 0;
    row.querySelector('.vat-rate').value = opt.dataset.vat || 5;
  }
  calcLine(idx);
}

function calcLine(idx) {
  const row = document.getElementById(`line-${idx}`);
  const qty = parseFloat(row.querySelector('.qty').value) || 0;
  const price = parseFloat(row.querySelector('.price').value) || 0;
  const disc = parseFloat(row.querySelector('.disc').value) || 0;
  const vat = parseFloat(row.querySelector('.vat-rate').value) || 0;
  const lineBase = qty * price;
  const lineDisc = lineBase * disc / 100;
  const lineAfterDisc = lineBase - lineDisc;
  const lineVat = lineAfterDisc * vat / 100;
  const total = lineAfterDisc + lineVat;
  row.querySelector('.line-total').textContent = total.toFixed(3);
  calcTotals();
}

function calcTotals() {
  let subtotal = 0, discTotal = 0, vatTotal = 0, grandTotal = 0;
  document.querySelectorAll('#lines-body tr').forEach(row => {
    const qty = parseFloat(row.querySelector('.qty')?.value) || 0;
    const price = parseFloat(row.querySelector('.price')?.value) || 0;
    const disc = parseFloat(row.querySelector('.disc')?.value) || 0;
    const vat = parseFloat(row.querySelector('.vat-rate')?.value) || 0;
    const base = qty * price;
    const d = base * disc / 100;
    const after = base - d;
    const v = after * vat / 100;
    subtotal += base; discTotal += d; vatTotal += v; grandTotal += after + v;
  });
  document.getElementById('subtotal').textContent = subtotal.toFixed(3);
  document.getElementById('discount-total').textContent = discTotal.toFixed(3);
  document.getElementById('vat-total').textContent = vatTotal.toFixed(3);
  document.getElementById('grand-total').textContent = grandTotal.toFixed(3);
  serializeLines();
}

function serializeLines() {
  const lines = [];
  document.querySelectorAll('#lines-body tr').forEach(row => {
    const sel = row.querySelector('.product-sel');
    if (sel && sel.value) {
      lines.push({
        product_id: sel.value,
        qty: row.querySelector('.qty').value,
        unit_price: row.querySelector('.price').value,
        discount_pct: row.querySelector('.disc').value,
        vat_rate: row.querySelector('.vat-rate').value,
      });
    }
  });
  document.getElementById('lines-json').value = JSON.stringify(lines);
}

function removeLine(idx) {
  document.getElementById(`line-${idx}`)?.remove();
  calcTotals();
}

document.getElementById('product-search').addEventListener('input', function() {
  const q = this.value.toLowerCase();
  if (q.length < 2) return;
  const match = products.find(p =>
    p.name_ar.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(q))
  );
  if (match) { addProductRow(match); this.value = ''; }
});

document.getElementById('invoice-form').addEventListener('submit', serializeLines);
</script>
{% endblock %}
```

- [ ] **Step 6: Create print template for PDF**

```html
<!-- app/templates/sales/invoices/print.html -->
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Arial', sans-serif; font-size: 13px; }
    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px; }
    .company-name { font-size: 22px; font-weight: bold; }
    .invoice-title { font-size: 18px; color: #444; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: center; }
    th { background: #f0f0f0; font-weight: bold; }
    .totals-table { width: 300px; margin-right: auto; }
    .totals-table td { border: none; }
    .grand-total { font-size: 16px; font-weight: bold; color: #1a6e3a; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
<div class="header">
  <div class="company-name">{{ company_name }}</div>
  <div class="invoice-title">فاتورة بيع — {{ invoice.type_label }}</div>
  <div>رقم الفاتورة: <strong>{{ invoice.invoice_no }}</strong> | التاريخ: {{ invoice.date }}</div>
</div>
<div style="display:flex; justify-content:space-between; margin-bottom:10px">
  <div>
    <strong>بيانات العميل:</strong><br>
    الاسم: {{ invoice.customer.name }}<br>
    الهاتف: {{ invoice.customer.phone }}<br>
    العنوان: {{ invoice.customer.address }}
  </div>
  <div>
    {% if invoice.due_date %}تاريخ الاستحقاق: {{ invoice.due_date }}<br>{% endif %}
    الفرع: {{ branch.name }}
  </div>
</div>
<table>
  <thead>
    <tr><th>#</th><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الخصم %</th><th>ضريبة</th><th>الإجمالي</th></tr>
  </thead>
  <tbody>
    {% for item in invoice.items %}
    <tr>
      <td>{{ loop.index }}</td>
      <td>{{ item.product.name_ar }}</td>
      <td>{{ item.qty }}</td>
      <td>{{ "%.3f"|format(item.unit_price) }}</td>
      <td>{{ item.discount_pct }}%</td>
      <td>{{ "%.3f"|format(item.vat_amount) }}</td>
      <td>{{ "%.3f"|format(item.line_total) }}</td>
    </tr>
    {% endfor %}
  </tbody>
</table>
<table class="totals-table">
  <tr><td>المجموع الفرعي</td><td>{{ "%.3f"|format(invoice.subtotal) }}</td></tr>
  <tr><td>الخصم</td><td>{{ "%.3f"|format(invoice.discount_total) }}</td></tr>
  <tr><td>ضريبة القيمة المضافة (5%)</td><td>{{ "%.3f"|format(invoice.vat_total) }}</td></tr>
  <tr class="grand-total"><td><strong>الإجمالي النهائي</strong></td>
      <td><strong>{{ "%.3f"|format(invoice.grand_total) }}</strong></td></tr>
</table>
<div style="margin-top:30px; border-top:1px solid #ccc; padding-top:10px; font-size:11px; text-align:center;">
  شكراً لتعاملكم معنا — هذه الفاتورة وثيقة قانونية
</div>
<div class="no-print" style="text-align:center; margin-top:20px">
  <button onclick="window.print()">طباعة</button>
</div>
</body>
</html>
```

- [ ] **Step 7: Run tests — expect pass**

```bash
pytest tests/test_sales.py -v
# Expected: 4 passed
```

- [ ] **Step 8: Commit**

```bash
git commit -m "feat: add Sales module with invoice creation, VAT calc, stock deduction, PDF print template"
```

---

### Task 5 — Inventory Module

**Files:**
- Create: `erp/app/models/inventory.py`
- Create: `erp/app/blueprints/inventory/`
- Create: `erp/app/services/inventory_service.py`
- Templates: products list/form, warehouses, stock movements, transfer, reorder alerts

- [ ] **Step 1: Create app/models/inventory.py** (see ERD above for fields)
- [ ] **Step 2: Implement CRUD routes for products, categories, warehouses**
- [ ] **Step 3: Implement stock movement routes (IN/OUT/ADJUSTMENT)**
- [ ] **Step 4: Implement inter-warehouse transfer with two-phase (request → confirm)**
- [ ] **Step 5: Implement reorder alert query (products where batch qty < reorder_level)**
- [ ] **Step 6: Write and run tests**
- [ ] **Step 7: Commit**

---

### Task 6 — Purchasing & Import (Landed Cost)

**Files:**
- Create: `erp/app/models/purchasing.py`
- Create: `erp/app/blueprints/purchasing/`
- Service logic: distribute import costs across batch unit_cost

- [ ] **Step 1: Create purchasing models** (Supplier, PO, POItem, ImportCost, GR, GRItem)
- [ ] **Step 2: Implement PO CRUD with status flow (DRAFT → APPROVED → RECEIVED)**
- [ ] **Step 3: Implement Goods Receipt — creates ProductBatch, triggers StockMovement IN**
- [ ] **Step 4: Implement Landed Cost — distribute import costs proportionally to GR qty**
- [ ] **Step 5: Auto-generate purchase journal entry on GR confirmation**
- [ ] **Step 6: Write and run tests**
- [ ] **Step 7: Commit**

---

### Task 7 — HR Module

**Files:**
- Create: `erp/app/models/hr.py`
- Create: `erp/app/blueprints/hr/`
- Create: `erp/app/services/hr_service.py`

- [ ] **Step 1: Create HR models** (Employee, Contract, Attendance, Leave, SalaryPayment, Advance)
- [ ] **Step 2: Implement employee CRUD with photo upload**
- [ ] **Step 3: Implement attendance (bulk daily entry or individual)**
- [ ] **Step 4: Implement leave request + approval workflow**
- [ ] **Step 5: Implement salary calculation (basic + allowances - deductions - advance repayment)**
- [ ] **Step 6: Auto-generate payroll journal entry**
- [ ] **Step 7: Write and run tests**
- [ ] **Step 8: Commit**

---

### Task 8 — Fleet & Distribution

**Files:**
- Create: `erp/app/models/fleet.py`
- Create: `erp/app/blueprints/fleet/`

- [ ] **Step 1: Create fleet models** (Vehicle, Maintenance, Fuel, Route, LoadOrder, LoadItem, Delivery)
- [ ] **Step 2: Vehicle management with license expiry alerts**
- [ ] **Step 3: Load order — link multiple invoices to a vehicle + driver**
- [ ] **Step 4: Delivery tracking — mark as delivered/returned, record collected amount**
- [ ] **Step 5: Write and run tests**
- [ ] **Step 6: Commit**

---

### Task 9 — Accounting Reports

**Files:**
- Create: `erp/app/blueprints/accounting/reports.py`
- Templates: ledger, trial balance, P&L, balance sheet, VAT report, aging report

- [ ] **Step 1: General Ledger (دفتر الأستاذ) — filter by account, branch, period**
- [ ] **Step 2: Trial Balance (ميزان المراجعة) — all leaf accounts with debit/credit totals**
- [ ] **Step 3: Profit & Loss (قائمة الأرباح والخسائر)**
- [ ] **Step 4: Balance Sheet (المركز المالي)**
- [ ] **Step 5: VAT Report (تقرير ضريبة القيمة المضافة) — input vs output VAT by period**
- [ ] **Step 6: Customer Aging Report (أعمار الديون) — 0-30, 31-60, 61-90, 90+ days**
- [ ] **Step 7: Excel export using openpyxl for each report**
- [ ] **Step 8: PDF export using WeasyPrint**
- [ ] **Step 9: Fiscal period close/lock functionality**
- [ ] **Step 10: Commit**

---

### Task 10 — Dashboard & KPI

**Files:**
- Create: `erp/app/blueprints/dashboard/routes.py`
- Template: `erp/app/templates/dashboard/index.html`

- [ ] **Step 1: Dashboard cards — total sales today/month, outstanding receivables, low-stock count**
- [ ] **Step 2: Sales chart (last 12 months) using Chart.js with branch filter**
- [ ] **Step 3: Top 10 products by sales volume**
- [ ] **Step 4: Recent invoices table**
- [ ] **Step 5: Reorder alerts banner**
- [ ] **Step 6: Commit**

---

### Task 11 — Seed Data

**Files:**
- Create: `erp/seed/demo_seed.py`
- Create: `erp/seed/__init__.py` with `flask seed` CLI command

- [ ] **Step 1: Register `flask seed` command in app factory**

```python
@app.cli.command('seed')
def seed_command():
    from seed.coa_seed import seed_coa
    from seed.demo_seed import seed_demo
    from app.extensions import db
    from app.models import Account
    db.create_all()
    seed_coa(db, Account)
    seed_demo(db)
    print("✅ Database seeded successfully")
```

- [ ] **Step 2: demo_seed.py — creates HQ branch, 3 demo users, 20 products, 5 customers**
- [ ] **Step 3: Run seed and verify login works**

```bash
flask seed
flask run
# Browse to http://localhost:5000 — login with admin/admin123
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: add seed command with demo data for all modules"
```

---

### Task 12 — Hostinger VPS Deployment

**Files:**
- Create: `erp/deploy/nginx.conf`
- Create: `erp/deploy/erp.service` (systemd)
- Create: `erp/deploy/deploy.sh`

- [ ] **Step 1: Create nginx.conf**

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    location /static/ {
        alias /var/www/erp/app/static/;
    }
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

- [ ] **Step 2: Create systemd service file**

```ini
[Unit]
Description=ERP Flask Application
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/erp
Environment="PATH=/var/www/erp/venv/bin"
Environment="FLASK_ENV=production"
EnvironmentFile=/var/www/erp/.env
ExecStart=/var/www/erp/venv/bin/gunicorn --workers 3 --bind 127.0.0.1:8000 wsgi:application
Restart=always

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 3: Create deploy.sh**

```bash
#!/bin/bash
# Run on Hostinger VPS after SSH
set -e
cd /var/www/erp
git pull origin main
source venv/bin/activate
pip install -r requirements.txt
flask db upgrade
flask seed  # only first time — comment out after initial deploy
sudo systemctl restart erp
echo "✅ Deployment complete"
```

- [ ] **Step 4: Hostinger VPS setup commands**

```bash
# On Hostinger VPS (Ubuntu 22):
sudo apt update && sudo apt install -y python3.11 python3-pip python3-venv nginx
sudo mkdir -p /var/www/erp && sudo chown $USER:$USER /var/www/erp
git clone <repo-url> /var/www/erp
cd /var/www/erp && python3.11 -m venv venv
source venv/bin/activate && pip install -r requirements.txt
cp .env.example .env  # Edit SECRET_KEY and DATABASE_URL
flask db init && flask db migrate && flask db upgrade && flask seed
sudo cp deploy/nginx.conf /etc/nginx/sites-available/erp
sudo ln -s /etc/nginx/sites-available/erp /etc/nginx/sites-enabled/
sudo cp deploy/erp.service /etc/systemd/system/
sudo systemctl enable erp && sudo systemctl start erp
sudo nginx -t && sudo systemctl restart nginx
```

- [ ] **Step 5: For PostgreSQL on Hostinger (optional upgrade)**

```
DATABASE_URL=postgresql://username:password@localhost/erp_db
# Add psycopg2-binary to requirements.txt
```

- [ ] **Step 6: Commit final deployment files**

```bash
git commit -m "feat: add Hostinger VPS deployment config (nginx, systemd, deploy script)"
```

---

## Self-Review Checklist

| Requirement | Task(s) |
|------------|---------|
| Multi-branch with unified dashboard | Task 2, COA branch_id filter |
| HR full cycle | Task 7 |
| Inventory with batches, reorder, expiry | Task 5 |
| Purchasing + landed cost | Task 6 |
| Sales invoice with VAT, stock deduction | Tasks 3+4 |
| Quotation → Invoice conversion | Task 4 Step 4 |
| Sales returns | Task 4 (SalesReturn model) |
| Customer credit limit + aging | Task 4, Task 9 Step 6 |
| COA hierarchical tree | Task 3 |
| Auto journal entries from all sources | accounting_service.py |
| Manual journal with balance check | Task 3 Step 5 |
| Multiple cash/bank accounts | CashVoucher + Bank models |
| Accounting reports (5 reports) | Task 9 |
| Fiscal period lock | Task 9 Step 9 |
| Fleet + distribution | Task 8 |
| Dashboard with charts | Task 10 |
| Arabic RTL UI | Task 2 (base.html) |
| PDF invoice print | Task 4 Step 6 |
| Excel export | Task 9 Step 7 |
| Seed data + standard COA | Tasks 1+11 |
| Hostinger deployment | Task 12 |

All 8 modules covered. No placeholders detected.
