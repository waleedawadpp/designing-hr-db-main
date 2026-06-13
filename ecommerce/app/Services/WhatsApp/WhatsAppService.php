<?php

namespace App\Services\WhatsApp;

use App\Models\Order;
use App\Models\Setting;

/**
 * Façade over the configured WhatsApp driver. The driver is selected
 * at runtime from config('whatsapp.driver') so the integration can be
 * swapped (Meta Cloud / Twilio / Business API) without touching callers.
 */
class WhatsAppService
{
    public function __construct(private readonly WhatsAppDriver $driver)
    {
    }

    public function send(string $to, string $message): bool
    {
        return $this->driver->send($to, $message);
    }

    public function sendOrderNotification(Order $order): bool
    {
        $admin = Setting::get('whatsapp_number');
        $currency = Setting::get('currency', 'USD');

        $message = "🛒 New Order: {$order->order_number}\n"
            ."Customer: {$order->customer_name}\n"
            ."Phone: {$order->phone}\n"
            ."Total: {$order->total} {$currency}";

        $sent = true;
        if ($admin) {
            $sent = $this->driver->send($admin, $message) && $sent;
        }
        // Confirmation to the customer.
        $sent = $this->driver->send($order->phone, $message) && $sent;

        return $sent;
    }
}
