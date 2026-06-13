# Local Installation Guide

This guide walks you through running the Premium Store platform on a local development
machine. The project is built on **Laravel 12**.

## Requirements

| Tool | Version | Notes |
|---|---|---|
| PHP | 8.3+ | `composer.json` requires `^8.2`; 8.3+ recommended. Extensions: `mbstring`, `pdo`, `gd`/`imagick`, `intl`, `fileinfo`, `openssl`, `bcmath` |
| Composer | 2.x | dependency manager |
| Node.js | 18+ | for Vite asset build |
| npm | 9+ | ships with Node |
| Database | SQLite (default for dev) or MySQL 8 | SQLite needs no server; MySQL recommended for production parity |

The image pipeline uses `intervention/image-laravel`, which requires the **GD** or
**Imagick** PHP extension to convert uploads to WebP.

## Installation steps

### 1. Clone the repository

```bash
git clone <repository-url>
cd ecommerce
```

### 2. Install PHP dependencies

```bash
composer install
```

### 3. Create the environment file

```bash
cp .env.example .env
```

### 4. Generate the application key

```bash
php artisan key:generate
```

### 5. Configure the database

The default `.env` uses SQLite, which is the quickest way to get started:

```dotenv
DB_CONNECTION=sqlite
```

Create the SQLite file:

```bash
touch database/database.sqlite
```

To use **MySQL 8** instead, edit `.env`:

```dotenv
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=premium_store
DB_USERNAME=root
DB_PASSWORD=secret
```

### 6. Run migrations and seed demo data

```bash
php artisan migrate --seed
```

This creates all tables and runs the seeders in `database/seeders/`
(`RolePermissionSeeder`, `SettingsSeeder`, `UserSeeder`, `CatalogSeeder`).

### 7. Link the storage directory

Product images, banners and invoices are written to the `public` disk and served from
`storage/app/public`. Create the symlink:

```bash
php artisan storage:link
```

### 8. Build front-end assets

```bash
npm install
npm run build
```

For active front-end development, use the watcher instead of a one-off build:

```bash
npm run dev
```

### 9. Serve the application

```bash
php artisan serve
```

The site is now available at <http://localhost:8000>. The default application locale is
**Arabic (`ar`)** with English (`en`) as a fallback; locales render RTL/LTR accordingly.

### One-command setup (alternative)

`composer.json` defines a `setup` script that performs install, key generation, migration
and asset build in one go:

```bash
composer setup
```

A combined dev runner (server + queue + logs + Vite) is also available:

```bash
composer dev
```

## Seeded accounts

`UserSeeder` creates three accounts. **All passwords are `password`.**

| Email | Name | Role | Purpose |
|---|---|---|---|
| `admin@example.com` | Super Admin | Super Admin | Full access to the admin panel and all permissions |
| `manager@example.com` | Store Manager | Admin | Products, categories, orders, settings, dashboard |
| `customer@example.com` | Demo Customer | Customer | Standard storefront customer |

The admin panel is gated by the middleware `role:Super Admin|Admin|Content Manager`, so the
customer account cannot reach `/admin`.

## Roles & permissions

Seeded by `RolePermissionSeeder`:

| Role | Permissions |
|---|---|
| Super Admin | all permissions |
| Admin | manage products, manage categories, manage orders, manage settings, view dashboard |
| Content Manager | manage products, manage categories, manage banners, manage media, view dashboard |
| Customer | none (storefront only) |

## Demo coupons

`CatalogSeeder` creates two ready-to-use coupons:

| Code | Type | Value | Conditions |
|---|---|---|---|
| `WELCOME10` | percentage | 10% | no minimum |
| `SAVE50` | fixed | 50 (currency units) | minimum order amount of 200 |

The catalog seeder also generates 5 root categories (each with 2–3 children and several
products), 6 featured products and 3 banners.

## Useful commands

```bash
php artisan migrate:fresh --seed   # rebuild the database from scratch with demo data
php artisan optimize:clear         # clear config/route/view/event caches
php artisan test                   # run the test suite
```
