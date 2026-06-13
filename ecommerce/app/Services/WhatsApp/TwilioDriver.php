<?php

namespace App\Services\WhatsApp;

use Illuminate\Support\Facades\Http;

/**
 * Twilio WhatsApp API driver.
 * Docs: https://www.twilio.com/docs/whatsapp
 */
class TwilioDriver implements WhatsAppDriver
{
    public function send(string $to, string $message): bool
    {
        $sid = config('whatsapp.twilio.sid');
        $token = config('whatsapp.twilio.token');
        $from = config('whatsapp.twilio.from');

        $response = Http::asForm()
            ->withBasicAuth($sid, $token)
            ->post("https://api.twilio.com/2010-04-01/Accounts/{$sid}/Messages.json", [
                'From' => 'whatsapp:'.$from,
                'To' => 'whatsapp:'.$to,
                'Body' => $message,
            ]);

        return $response->successful();
    }
}
