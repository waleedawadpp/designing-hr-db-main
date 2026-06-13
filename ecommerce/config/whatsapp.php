<?php

return [
    /*
    | Active driver: meta | twilio | business | log
    | Defaults to "log" so the app is safe out of the box.
    */
    'driver' => env('WHATSAPP_DRIVER', 'log'),

    'meta' => [
        'token' => env('WHATSAPP_META_TOKEN'),
        'phone_number_id' => env('WHATSAPP_META_PHONE_ID'),
    ],

    'twilio' => [
        'sid' => env('TWILIO_SID'),
        'token' => env('TWILIO_TOKEN'),
        'from' => env('TWILIO_WHATSAPP_FROM'),
    ],

    'business' => [
        'endpoint' => env('WHATSAPP_BUSINESS_ENDPOINT'),
        'token' => env('WHATSAPP_BUSINESS_TOKEN'),
    ],
];
