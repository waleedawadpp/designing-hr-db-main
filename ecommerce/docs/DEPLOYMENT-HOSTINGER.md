# Deployment Guide — Hostinger Shared Hosting

This guide covers deploying the Premium Store platform to **Hostinger Business** or
**Premium** shared hosting. Shared hosting has constraints (no long-running daemons,
sometimes restricted SSH), so a few workarounds are included.

> Prerequisites: a Hostinger plan with PHP **8.3**, a MySQL database, and SSH or File
> Manager access. Set the PHP version from **hPanel → Advanced → PHP Configuration**.

## 1. Upload the application files

You can either clone via SSH or upload a build via File Manager / FTP.

```bash
# Via SSH (preferred)
cd ~/domains/yourdomain.com
git clone <repository-url> app
cd app
```

If uploading manually, exclude `node_modules/` and `vendor/` and build/install them on the
server (or upload a vendor bundle if SSH is unavailable).

## 2. Point the document root at /public

Laravel must serve from the `public/` directory, never the project root.

- **Option A (recommended):** In **hPanel → Domains → your domain → set document root** to
  `app/public`.
- **Option B:** If the document root is fixed to `public_html`, place the project one level
  up and symlink or move `public/` contents into `public_html`, then edit `public_html/index.php`
  to point `require` paths at the relocated `vendor/autoload.php` and `bootstrap/app.php`.

Always keep `.env`, `vendor/`, `storage/` and `bootstrap/` **outside** the web root.

## 3. Configure the production .env

```dotenv
APP_NAME="Premium Store"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://yourdomain.com

APP_LOCALE=ar
APP_FALLBACK_LOCALE=en

LOG_CHANNEL=stack
LOG_LEVEL=error

DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=u123456_store
DB_USERNAME=u123456_user
DB_PASSWORD=your-strong-password

SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=database

FILESYSTEM_DISK=local

# Mail — see SMTP section below
MAIL_MAILER=smtp

# WhatsApp — see docs/WHATSAPP.md (defaults to safe log driver)
WHATSAPP_DRIVER=log
```

Generate the key if it is not already set:

```bash
php artisan key:generate
```

## 4. Install dependencies (production)

```bash
composer install --no-dev --optimize-autoloader
```

Build front-end assets locally and upload `public/build/`, or build on the server if Node is
available:

```bash
npm install && npm run build
```

## 5. Cache configuration for performance

```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache
```

> Re-run these after every deploy or `.env` change. To undo, run `php artisan optimize:clear`.

## 6. Run migrations

```bash
php artisan migrate --force
```

The `--force` flag is required to run migrations in the `production` environment. Seed only
on first deploy if you want demo data (usually skip in production).

## 7. Link storage

```bash
php artisan storage:link
```

### Symlink workaround for restricted shells

Some shared plans disable the `symlink()` function via the shell or block `artisan storage:link`.
Drop a small PHP script in `public/` and hit it once in the browser, then delete it:

```php
<?php
// public/storage-link.php  — run once, then DELETE this file.
$target = __DIR__ . '/../storage/app/public';
$link   = __DIR__ . '/storage';

if (is_link($link) || file_exists($link)) {
    echo 'Link already exists.';
    return;
}

if (symlink($target, $link)) {
    echo 'storage symlink created successfully.';
} else {
    echo 'symlink() failed — your host may disable it. Ask support to create the link.';
}
```

Visit `https://yourdomain.com/storage-link.php`, confirm success, then **delete the file**.
If `symlink()` is disabled entirely, ask Hostinger support to create the link or switch
`FILESYSTEM_DISK` handling so public files are served from a directly accessible folder.

## 8. File permissions

Web server needs write access to two paths only:

```bash
chmod -R 775 storage bootstrap/cache
```

Ensure ownership matches the web user (Hostinger usually handles this). Never make the
project world-writable, and keep `.env` at `600`/`640`.

## 9. Cron job for the Laravel scheduler

The scheduler drives backups and any scheduled maintenance. Add one cron entry in
**hPanel → Advanced → Cron Jobs** running every minute:

```cron
* * * * * php /home/u123456/domains/yourdomain.com/app/artisan schedule:run >> /dev/null 2>&1
```

Adjust the path to your absolute artisan path and PHP binary (some hosts need
`/usr/bin/php8.3`).

## 10. Queue configuration (no daemons)

`QUEUE_CONNECTION=database` is used because shared hosting cannot run a persistent
`queue:work` daemon. Instead, drain the queue from cron on a schedule:

```cron
* * * * * php /home/u123456/domains/yourdomain.com/app/artisan queue:work --stop-when-empty --max-time=55 >> /dev/null 2>&1
```

`--stop-when-empty` exits as soon as the queue is empty, and `--max-time=55` guarantees the
worker terminates before the next cron tick, avoiding overlap. The `jobs` and `failed_jobs`
tables are created by the base Laravel migrations.

> Note: In this project, order email and WhatsApp notifications are dispatched synchronously
> inside `OrderService` (wrapped in try/catch so they never break checkout). The queue is in
> place for future async work and for any queued mail you enable.

## 11. SSL via the Hostinger panel

Enable a free SSL certificate from **hPanel → Security → SSL**. After issuance, force HTTPS
(hPanel toggle or `.htaccess`) and confirm `APP_URL` uses `https://`. Laravel will then
generate secure absolute URLs.

## 12. SMTP setup (email notifications)

Order confirmation emails are sent through Laravel mail. Configure one of the following in
`.env`:

**Hostinger SMTP (Titan / hosted email):**
```dotenv
MAIL_MAILER=smtp
MAIL_HOST=smtp.hostinger.com
MAIL_PORT=465
MAIL_USERNAME=info@yourdomain.com
MAIL_PASSWORD=your-mailbox-password
MAIL_SCHEME=smtps
MAIL_FROM_ADDRESS=info@yourdomain.com
MAIL_FROM_NAME="Premium Store"
```

**Gmail SMTP (app password required):**
```dotenv
MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=youraccount@gmail.com
MAIL_PASSWORD=your-16-char-app-password
MAIL_SCHEME=tls
MAIL_FROM_ADDRESS=youraccount@gmail.com
```

**Custom SMTP relay (SendGrid, Mailgun, etc.):** set `MAIL_HOST`, `MAIL_PORT`,
`MAIL_USERNAME`, `MAIL_PASSWORD` and scheme as supplied by the provider.

After editing mail settings, re-run `php artisan config:cache`.

## 13. Security hardening checklist

- [ ] `APP_DEBUG=false` and `APP_ENV=production`.
- [ ] `APP_KEY` is set and unique to this deployment.
- [ ] `.env` permissions `640` or stricter; never committed to git.
- [ ] Document root points at `/public`; `vendor/`, `storage/`, `.env` are outside the web root.
- [ ] HTTPS enforced; `APP_URL` uses `https://`.
- [ ] Default seeded passwords changed (rotate `admin@example.com` immediately, or seed real users).
- [ ] Demo coupons (`WELCOME10`, `SAVE50`) reviewed/removed before launch.
- [ ] `storage` and `bootstrap/cache` are `775`; nothing else world-writable.
- [ ] Config/route/view/event caches built and refreshed on each deploy.
- [ ] Database user scoped to a single database with a strong password.
- [ ] `LOG_LEVEL=error` to avoid leaking detail; logs rotated.
- [ ] Scheduler and queue cron jobs verified working.
- [ ] Backups configured and tested (see `docs/PRODUCTION.md`).
- [ ] Remove any one-off helper scripts (e.g. `storage-link.php`) after use.
