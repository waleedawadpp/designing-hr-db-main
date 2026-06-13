<?php

namespace App\Providers;

use App\Services\WhatsApp\BusinessApiDriver;
use App\Services\WhatsApp\LogDriver;
use App\Services\WhatsApp\MetaCloudDriver;
use App\Services\WhatsApp\TwilioDriver;
use App\Services\WhatsApp\WhatsAppDriver;
use Illuminate\Pagination\Paginator;
use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Resolve the WhatsApp driver from configuration.
        $this->app->bind(WhatsAppDriver::class, function () {
            return match (config('whatsapp.driver')) {
                'meta' => new MetaCloudDriver(),
                'twilio' => new TwilioDriver(),
                'business' => new BusinessApiDriver(),
                default => new LogDriver(),
            };
        });
    }

    public function boot(): void
    {
        Paginator::useTailwind();

        // Share cart + settings with all views.
        View::composer('*', \App\View\Composers\GlobalComposer::class);
    }
}
