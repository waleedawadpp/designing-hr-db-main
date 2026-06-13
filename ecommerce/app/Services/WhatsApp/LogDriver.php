<?php

namespace App\Services\WhatsApp;

use Illuminate\Support\Facades\Log;

/**
 * Null/log driver used as a safe default and for local development.
 */
class LogDriver implements WhatsAppDriver
{
    public function send(string $to, string $message): bool
    {
        Log::info('[WhatsApp] message', ['to' => $to, 'message' => $message]);
        return true;
    }
}
