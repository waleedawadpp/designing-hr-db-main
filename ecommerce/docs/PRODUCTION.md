# Production Operations

Operational guidance for running the Premium Store platform in production: backups,
performance, monitoring, maintenance and scaling on shared hosting.

## Backup strategy

Backups are handled by **`spatie/laravel-backup`** (configured in `config/backup.php`). A
backup bundles the application files and a database dump into a single zip on the configured
disk(s).

### Manual backup

```bash
php artisan backup:run            # files + database
php artisan backup:run --only-db  # database only
php artisan backup:run --only-files
```

### Inspect and clean

```bash
php artisan backup:list     # show existing backups and their health
php artisan backup:clean    # apply retention/cleanup rules
php artisan backup:monitor  # verify backups are fresh and within size limits
```

### Scheduling

On shared hosting the scheduler runs from a one-minute cron entry (see
`docs/DEPLOYMENT-HOSTINGER.md`). Register the backup commands in the scheduler
(`routes/console.php` / the app's schedule definition), for example:

```php
Schedule::command('backup:clean')->daily()->at('01:00');
Schedule::command('backup:run')->daily()->at('01:30');
Schedule::command('backup:monitor')->daily()->at('02:00');
```

Configure the destination disk(s) and (optionally) off-site storage (S3) and notification
channels in `config/backup.php`. **Test a restore at least once** — an untested backup is not
a backup.

## Performance

### Caches

Build the framework caches after every deploy or config change:

```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache
```

Clear them with `php artisan optimize:clear` when troubleshooting.

### Eager loading

Catalog queries already avoid N+1 problems. `ProductRepository::catalog()` eager-loads
`category`, `findBySlug()` loads `category` and `images`, and the API resources only expose
relations via `whenLoaded()` / `whenCounted()`. Preserve this pattern when extending queries.

### Image optimization (WebP)

`App\Services\ImageService` processes every uploaded image: it scales down to a max width
(default 1200px), converts to **WebP at quality 82**, and stores it on the `public` disk with
a UUID filename. This keeps page weight low and avoids serving oversized originals. Deletion
is handled by `ImageService::delete()`.

### OPcache

Enable OPcache on the PHP runtime for a large throughput gain on shared hosting:

```ini
opcache.enable=1
opcache.memory_consumption=128
opcache.max_accelerated_files=10000
opcache.validate_timestamps=0   ; production: invalidate manually on deploy
```

With `validate_timestamps=0`, restart PHP-FPM or reset OPcache after each deploy so new code
is picked up.

### Database

The schema is indexed for the common access paths: `products` indexes `status`, `featured`,
`category_id`, `price`; `orders` indexes `order_number`, `status`, `user_id`, `created_at`;
slugs and SKUs are unique. Use `CACHE_STORE=database` (or Redis where available) and serve a
queue from cron rather than synchronously where work grows.

## Monitoring & logs

### Activity log

`spatie/laravel-activitylog` records audit trails in the `activity_log` table:

- `Product`, `Category` and `Order` models log dirty changes to selected attributes
  (configured via each model's `getActivitylogOptions()`).
- `OrderService` writes explicit `order` log entries on order placement and status changes,
  including the order total in `properties`.

Query the log via the `Spatie\Activitylog\Models\Activity` model, e.g. recent order activity:

```php
Activity::inLog('order')->latest()->take(50)->get();
```

### Application logs

Logs use the `stack` channel. In production set `LOG_LEVEL=error` (or `warning`) to limit
noise. Notification failures (mail / WhatsApp) are logged as warnings by `OrderService` so a
failed side-effect never breaks checkout. Rotate logs to control disk usage.

## Maintenance mode

```bash
php artisan down --secret="maintenance-bypass-token"   # enable, allow bypass via token
php artisan up                                          # disable
```

`APP_MAINTENANCE_DRIVER=file` is the default. Note there is also a `maintenance_mode` row in
the `settings` table — an application-level toggle distinct from Laravel's `artisan down`.

## Scaling notes on shared hosting

Shared hosting (Hostinger Business/Premium) has hard limits to design around:

- **No persistent daemons** — queues run via cron (`queue:work --stop-when-empty`), not a
  supervisor-managed worker. Keep jobs short.
- **CPU / memory / entry-process caps** — long requests can be killed. Heavy image processing
  is already minimized via WebP downscaling; avoid synchronous bulk operations.
- **Single-node** — no horizontal scaling. Lean on caching, OPcache and DB indexes.
- **Inode/storage limits** — prune old invoices, media conversions and backups regularly
  (`backup:clean`).
- **When you outgrow shared hosting**, move to a VPS/managed Laravel host where you can run a
  real queue worker (Supervisor/Horizon), Redis cache/sessions, and a dedicated database.
