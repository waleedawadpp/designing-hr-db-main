<?php

namespace App\Services\WhatsApp;

use Illuminate\Support\Facades\Http;

/**
 * Generic WhatsApp Business API (on-premise / BSP) driver.
 */
class BusinessApiDriver implements WhatsAppDriver
{
    public function send(string $to, string $message): bool
    {
        $endpoint = rtrim((string) config('whatsapp.business.endpoint'), '/');
        $token = config('whatsapp.business.token');

        $response = Http::withToken($token)->post($endpoint.'/v1/messages', [
            'to' => $to,
            'type' => 'text',
            'text' => ['body' => $message],
        ]);

        return $response->successful();
    }
}
