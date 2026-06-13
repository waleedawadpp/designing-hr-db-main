<?php

namespace App\Services\WhatsApp;

use Illuminate\Support\Facades\Http;

/**
 * Meta WhatsApp Cloud API driver.
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */
class MetaCloudDriver implements WhatsAppDriver
{
    public function send(string $to, string $message): bool
    {
        $phoneId = config('whatsapp.meta.phone_number_id');
        $token = config('whatsapp.meta.token');

        $response = Http::withToken($token)
            ->post("https://graph.facebook.com/v20.0/{$phoneId}/messages", [
                'messaging_product' => 'whatsapp',
                'to' => $this->normalize($to),
                'type' => 'text',
                'text' => ['body' => $message],
            ]);

        return $response->successful();
    }

    private function normalize(string $phone): string
    {
        return ltrim(preg_replace('/[^0-9]/', '', $phone), '0');
    }
}
