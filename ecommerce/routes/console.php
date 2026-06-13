<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Regenerate the sitemap daily and run a database-backed backup nightly.
Schedule::command('sitemap:generate')->dailyAt('03:00');
Schedule::command('backup:run')->dailyAt('02:00')->withoutOverlapping();
Schedule::command('queue:work --stop-when-empty')->everyMinute()->withoutOverlapping();
