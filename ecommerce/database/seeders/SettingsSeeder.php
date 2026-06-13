<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingsSeeder extends Seeder
{
    public function run(): void
    {
        $defaults = [
            ['key' => 'store_name', 'value' => 'Premium Store', 'group' => 'general'],
            ['key' => 'email', 'value' => 'info@example.com', 'group' => 'general'],
            ['key' => 'whatsapp_number', 'value' => '+10000000000', 'group' => 'general'],
            ['key' => 'address', 'value' => '123 Commerce St', 'group' => 'general'],
            ['key' => 'currency', 'value' => 'USD', 'group' => 'general'],
            ['key' => 'tax_percentage', 'value' => '5', 'group' => 'general'],
            ['key' => 'flat_shipping', 'value' => '10', 'group' => 'general'],
            ['key' => 'meta_description', 'value' => 'Premium multilingual online store.', 'group' => 'seo'],
            ['key' => 'facebook', 'value' => 'https://facebook.com', 'group' => 'social'],
            ['key' => 'instagram', 'value' => 'https://instagram.com', 'group' => 'social'],
            ['key' => 'twitter', 'value' => 'https://twitter.com', 'group' => 'social'],
            ['key' => 'maintenance_mode', 'value' => '0', 'group' => 'general'],
        ];

        foreach ($defaults as $setting) {
            Setting::updateOrCreate(['key' => $setting['key']], $setting);
        }
    }
}
