# Premium Store — Multilingual E-Commerce Platform

A production-ready, **multilingual (Arabic / English, RTL & LTR)** e-commerce platform built
on **Laravel 12**. It ships with a complete storefront, a role-based admin dashboard, PDF
invoicing, email and WhatsApp notifications, a public read-only REST API, and full SEO and
audit-logging support.

## Features

- **Multilingual storefront** — Arabic and English, with RTL/LTR layouts. All catalog content
  is stored bilingually (`*_ar` / `*_en`) and resolved per request via localized model accessors.
- **Product catalog** — categories with a self-referencing tree, products with galleries,
  stock, sale pricing, featured flags, search, filtering and sorting.
- **Cart & checkout** — session cart with coupons, save-for-later, tax & flat-rate shipping,
  guest or authenticated checkout, rate-limited order submission and atomic stock decrement.
- **PDF invoices** — generated per order (DomPDF) with QR code support and stored for re-download.
- **Notifications** — order confirmation emails plus WhatsApp alerts to store and customer via
  a pluggable driver (Meta Cloud / Twilio / Business API / log).
- **Coupons** — percentage or fixed discounts with minimum-order, usage-limit and validity windows.
- **Admin dashboard** — products, categories, coupons, banners, orders, settings; bulk product
  actions; dashboard charts and metrics.
- **Roles & permissions** — Super Admin, Admin, Content Manager, Customer via `spatie/laravel-permission`.
- **SEO** — meta titles/descriptions, sitemap generation and SEO tooling.
- **Activity logs** — audit trail of changes to products, categories and orders.
- **Backups** — file + database backups via `spatie/laravel-backup`.
- **Public REST API** — read-only v1 catalog API for headless/mobile clients.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Laravel 12 (PHP 8.3+) |
| Auth scaffolding | Laravel Breeze |
| Database | MySQL 8 (production) / SQLite (development) |
| Front-end build | Vite + Tailwind CSS |
| Queue / cache / sessions | Database driver (cron-driven on shared hosting) |

### Key packages

From `composer.json` (`require`):

| Package | Purpose |
|---|---|
| `laravel/framework` | Core framework (^12.0) |
| `laravel/tinker` | REPL |
| `mcamara/laravel-localization` | URL & route localization (AR/EN) |
| `spatie/laravel-permission` | Roles & permissions |
| `spatie/laravel-activitylog` | Audit / activity logging |
| `spatie/laravel-medialibrary` | Media associations & conversions |
| `spatie/laravel-backup` | File + database backups |
| `spatie/laravel-sitemap` | SEO sitemap generation |
| `artesaos/seotools` | SEO meta tags |
| `barryvdh/laravel-dompdf` | PDF invoice generation |
| `intervention/image-laravel` | Image processing / WebP conversion |
| `simplesoftwareio/simple-qrcode` | QR codes on invoices |

## Quick start

See **[docs/INSTALLATION.md](docs/INSTALLATION.md)** for full details. Short version:

```bash
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite        # default SQLite dev DB
php artisan migrate --seed
php artisan storage:link
npm install && npm run build
php artisan serve
```

Open <http://localhost:8000>.

## Default credentials

Seeded by `database/seeders/UserSeeder.php` — **all passwords are `password`**:

| Email | Role | Access |
|---|---|---|
| `admin@example.com` | Super Admin | Everything |
| `manager@example.com` | Admin | Products, categories, orders, settings, dashboard |
| `customer@example.com` | Customer | Storefront only |

Demo coupons: **`WELCOME10`** (10% off) and **`SAVE50`** (50 off, min order 200).

> Change these credentials and review demo coupons before going to production.

## Project structure

```
ecommerce/
├── app/
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── Admin/      # admin dashboard controllers
│   │   │   ├── Api/        # public v1 API controllers
│   │   │   └── Frontend/   # storefront controllers
│   │   └── Resources/      # API resource transformers
│   ├── Models/             # User, Category, Product, Order, Coupon, Banner, Setting, ...
│   ├── Repositories/       # ProductRepository, CategoryRepository, ...
│   ├── Services/           # Cart, Coupon, Image, Invoice, Order, Setting
│   │   └── WhatsApp/       # driver interface + Meta/Twilio/Business/Log drivers
│   └── Providers/          # AppServiceProvider (WhatsApp driver binding, view composers)
├── config/                 # shop.php, whatsapp.php, permission.php, backup.php, ...
├── database/
│   ├── migrations/         # schema (see docs/ER-DIAGRAM.md)
│   └── seeders/            # roles, settings, users, catalog
├── docs/                   # this documentation set
├── lang/                   # ar / en translations
├── resources/              # Blade views, JS, CSS (Tailwind + Vite)
└── routes/                 # web.php, admin.php, api.php, auth.php
```

## Documentation

| Document | Contents |
|---|---|
| [docs/INSTALLATION.md](docs/INSTALLATION.md) | Local setup, requirements, seeded data |
| [docs/ER-DIAGRAM.md](docs/ER-DIAGRAM.md) | Database schema, Mermaid ER diagram, table breakdown |
| [docs/API.md](docs/API.md) | Public read-only v1 REST API reference |
| [docs/WHATSAPP.md](docs/WHATSAPP.md) | WhatsApp driver architecture & configuration |
| [docs/DEPLOYMENT-HOSTINGER.md](docs/DEPLOYMENT-HOSTINGER.md) | Hostinger shared-hosting deployment |
| [docs/PRODUCTION.md](docs/PRODUCTION.md) | Backups, performance, monitoring, scaling |

## License

Released under the MIT License.
