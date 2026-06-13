<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\ImageService;
use App\Services\SettingService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class SettingController extends Controller
{
    public function __construct(
        private readonly SettingService $settings,
        private readonly ImageService $images,
    ) {
    }

    public function edit(): View
    {
        return view('admin.settings.edit', ['settings' => \App\Models\Setting::cached()]);
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'store_name' => ['nullable', 'string', 'max:191'],
            'email' => ['nullable', 'email'],
            'whatsapp_number' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string', 'max:500'],
            'currency' => ['nullable', 'string', 'max:10'],
            'tax_percentage' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'flat_shipping' => ['nullable', 'numeric', 'min:0'],
            'meta_description' => ['nullable', 'string', 'max:500'],
            'facebook' => ['nullable', 'url'],
            'instagram' => ['nullable', 'url'],
            'twitter' => ['nullable', 'url'],
            'maintenance_mode' => ['nullable', 'boolean'],
            'logo' => ['nullable', 'image', 'mimes:jpeg,png,jpg,webp,svg', 'max:2048'],
            'favicon' => ['nullable', 'image', 'mimes:png,ico,jpg', 'max:512'],
        ]);

        if ($request->hasFile('logo')) {
            $data['logo'] = $this->images->store($request->file('logo'), 'settings', 400);
        }
        if ($request->hasFile('favicon')) {
            $data['favicon'] = $this->images->store($request->file('favicon'), 'settings', 64);
        }
        $data['maintenance_mode'] = $request->boolean('maintenance_mode');

        $this->settings->saveMany($data);

        return back()->with('success', __('admin.settings_saved'));
    }
}
