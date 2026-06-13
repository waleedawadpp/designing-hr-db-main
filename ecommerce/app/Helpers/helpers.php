<?php

use App\Models\Setting;

if (! function_exists('setting')) {
    function setting(string $key, $default = null)
    {
        return Setting::get($key, $default);
    }
}

if (! function_exists('money')) {
    function money($amount): string
    {
        $currency = Setting::get('currency', 'USD');
        return number_format((float) $amount, 2).' '.$currency;
    }
}

if (! function_exists('current_dir')) {
    function current_dir(): string
    {
        return app()->getLocale() === 'ar' ? 'rtl' : 'ltr';
    }
}
