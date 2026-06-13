# WhatsApp Integration Guide

The platform can send WhatsApp notifications (new-order alerts to the store and a
confirmation to the customer). The integration is **driver-based**, so you can switch
providers entirely through configuration without changing any calling code.

## Architecture

```
OrderService
   └── WhatsAppService (façade)
          └── WhatsAppDriver (interface)
                 ├── MetaCloudDriver     (WHATSAPP_DRIVER=meta)
                 ├── TwilioDriver        (WHATSAPP_DRIVER=twilio)
                 ├── BusinessApiDriver   (WHATSAPP_DRIVER=business)
                 └── LogDriver           (WHATSAPP_DRIVER=log, default)
```

- **`config/whatsapp.php`** reads `WHATSAPP_DRIVER` (one of `meta | twilio | business | log`)
  and the per-provider credentials. It **defaults to `log`** so the application is safe out of
  the box and never makes external calls until you opt in.
- **`AppServiceProvider`** binds the `WhatsAppDriver` interface to the concrete driver chosen
  by `config('whatsapp.driver')` using a `match` expression. Anything other than the three
  real drivers falls back to `LogDriver`.
- **`WhatsAppService`** is a thin façade that receives the resolved driver via constructor
  injection and exposes `send()` and `sendOrderNotification()`.

### The `WhatsAppDriver` interface

```php
interface WhatsAppDriver
{
    // Send a plain-text WhatsApp message to an E.164 phone number. Returns true on success.
    public function send(string $to, string $message): bool;
}
```

Every driver implements this single method.

## Drivers

### LogDriver (default)
Writes the message to the application log instead of sending it, and returns `true`. Ideal for
local development and as a safe production default. No credentials required.

### MetaCloudDriver (`meta`)
Sends via the **Meta WhatsApp Cloud API** (`graph.facebook.com/v20.0/{phone_id}/messages`).
Uses a bearer token and normalizes the destination number to digits only. Returns the HTTP
success state.

### TwilioDriver (`twilio`)
Sends via the **Twilio WhatsApp API**
(`api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json`). Uses HTTP Basic auth with the
Account SID and auth token, and prefixes both `From` and `To` numbers with `whatsapp:`.

### BusinessApiDriver (`business`)
Sends via a **generic WhatsApp Business API / BSP / on-premise** gateway. Posts a text message
to `{endpoint}/v1/messages` with a bearer token. The endpoint is configurable, so this driver
suits self-hosted or third-party BSP gateways.

## Environment variables

Set the active driver, then fill in the variables for that provider only.

```dotenv
# meta | twilio | business | log
WHATSAPP_DRIVER=log
```

### Meta WhatsApp Cloud API
```dotenv
WHATSAPP_DRIVER=meta
WHATSAPP_META_TOKEN=your-permanent-access-token
WHATSAPP_META_PHONE_ID=your-phone-number-id
```

### Twilio
```dotenv
WHATSAPP_DRIVER=twilio
TWILIO_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TOKEN=your-auth-token
TWILIO_WHATSAPP_FROM=+14155238886
```

### Generic Business API (BSP / on-premise)
```dotenv
WHATSAPP_DRIVER=business
WHATSAPP_BUSINESS_ENDPOINT=https://your-bsp-gateway.example.com
WHATSAPP_BUSINESS_TOKEN=your-gateway-token
```

After changing any of these in production, run `php artisan config:cache` to refresh the
cached configuration.

## How notifications are triggered

When a customer completes checkout, `OrderService::placeOrder()` creates the order, generates
the PDF invoice, then dispatches side-effect notifications via
`OrderService::dispatchNotifications()`:

```php
$this->whatsapp->sendOrderNotification($order);
```

`WhatsAppService::sendOrderNotification(Order $order)` builds a message such as:

```
🛒 New Order: ORD-20260613-000123
Customer: Jane Doe
Phone: +1555....
Total: 149.00 USD
```

and sends it to **two recipients**:

1. **The store** — the admin number from the `whatsapp_number` setting (`Setting::get('whatsapp_number')`), if configured.
2. **The customer** — the phone number captured on the order.

The currency in the message comes from the `currency` setting (default `USD`).

### Failure handling

The WhatsApp call is wrapped in a `try/catch` inside `OrderService`. If the provider fails or
credentials are missing, the error is logged as a warning (`WhatsApp notification failed`) and
**checkout still completes successfully**. Notifications are best-effort and never block an order.

## Testing the integration

1. Keep `WHATSAPP_DRIVER=log` and place a test order — confirm the message appears in the log
   (`storage/logs/laravel.log`).
2. Switch to a real driver, set its credentials, ensure the `whatsapp_number` setting holds a
   valid E.164 number, and place another test order.
3. Verify both the store and customer receive the message; check logs for any warning if not.
