<?php

namespace App\Services;

use App\Models\Setting;

class SettingService
{
    public function saveMany(array $settings, string $group = 'general'): void
    {
        foreach ($settings as $key => $value) {
            Setting::set($key, is_array($value) ? json_encode($value) : $value, $group);
        }
    }
}
