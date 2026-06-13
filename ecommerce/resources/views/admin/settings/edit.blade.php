@extends('layouts.admin')

@section('title', __('admin.settings'))

@php
    $get = function ($key, $default = null) use ($settings) {
        if (isset($settings) && method_exists($settings, 'get')) {
            return $settings->get($key, setting($key, $default));
        }
        return setting($key, $default);
    };
@endphp

@section('content')
<div class="space-y-6">
    <h1 class="text-2xl font-extrabold text-gray-900">{{ __('admin.store_settings') }}</h1>

    <form action="{{ route('admin.settings.update') }}" method="POST" enctype="multipart/form-data" class="space-y-6 max-w-4xl">
        @csrf
        {{-- General --}}
        <div class="bg-white rounded-2xl border border-gray-100 card-shadow p-6 space-y-5">
            <h2 class="font-bold text-gray-900">{{ __('admin.store_settings') }}</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.store_name') }}</label>
                    <input type="text" name="store_name" value="{{ old('store_name', $get('store_name')) }}" class="w-full rounded-xl border-gray-200">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.email_address') }}</label>
                    <input type="email" name="email" value="{{ old('email', $get('email')) }}" class="w-full rounded-xl border-gray-200">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.whatsapp_number') }}</label>
                    <input type="text" name="whatsapp_number" value="{{ old('whatsapp_number', $get('whatsapp_number')) }}" class="w-full rounded-xl border-gray-200">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.address') }}</label>
                    <input type="text" name="address" value="{{ old('address', $get('address')) }}" class="w-full rounded-xl border-gray-200">
                </div>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.meta_description') }}</label>
                <textarea name="meta_description" rows="2" class="w-full rounded-xl border-gray-200">{{ old('meta_description', $get('meta_description')) }}</textarea>
            </div>
        </div>

        {{-- Commerce --}}
        <div class="bg-white rounded-2xl border border-gray-100 card-shadow p-6 space-y-5">
            <h2 class="font-bold text-gray-900">{{ __('admin.currency') }} &amp; {{ __('admin.tax_percentage') }}</h2>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.currency') }}</label>
                    <input type="text" name="currency" value="{{ old('currency', $get('currency', 'USD')) }}" class="w-full rounded-xl border-gray-200">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.tax_percentage') }}</label>
                    <input type="number" step="0.01" name="tax_percentage" value="{{ old('tax_percentage', $get('tax_percentage')) }}" class="w-full rounded-xl border-gray-200">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.flat_shipping') }}</label>
                    <input type="number" step="0.01" name="flat_shipping" value="{{ old('flat_shipping', $get('flat_shipping')) }}" class="w-full rounded-xl border-gray-200">
                </div>
            </div>
        </div>

        {{-- Social --}}
        <div class="bg-white rounded-2xl border border-gray-100 card-shadow p-6 space-y-5">
            <h2 class="font-bold text-gray-900">{{ __('admin.social_links') }}</h2>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.facebook') }}</label>
                    <input type="url" name="facebook" value="{{ old('facebook', $get('facebook')) }}" class="w-full rounded-xl border-gray-200">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.instagram') }}</label>
                    <input type="url" name="instagram" value="{{ old('instagram', $get('instagram')) }}" class="w-full rounded-xl border-gray-200">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.twitter') }}</label>
                    <input type="url" name="twitter" value="{{ old('twitter', $get('twitter')) }}" class="w-full rounded-xl border-gray-200">
                </div>
            </div>
        </div>

        {{-- Branding --}}
        <div class="bg-white rounded-2xl border border-gray-100 card-shadow p-6 space-y-5">
            <h2 class="font-bold text-gray-900">{{ __('admin.logo') }} &amp; {{ __('admin.favicon') }}</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.logo') }}</label>
                    @if($get('logo'))<img src="{{ asset('storage/'.$get('logo')) }}" class="h-12 mb-2" alt="">@endif
                    <input type="file" name="logo" accept="image/*" class="w-full text-sm">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.favicon') }}</label>
                    @if($get('favicon'))<img src="{{ asset('storage/'.$get('favicon')) }}" class="h-10 mb-2" alt="">@endif
                    <input type="file" name="favicon" accept="image/*" class="w-full text-sm">
                </div>
            </div>
            <label class="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="maintenance_mode" value="1" @checked(old('maintenance_mode', $get('maintenance_mode'))) class="rounded border-gray-300 text-indigo-600">
                {{ __('admin.maintenance_mode') }}
            </label>
        </div>

        <button type="submit" class="rounded-full bg-gray-900 text-white font-semibold px-8 py-3 hover:bg-indigo-600 transition">{{ __('admin.save') }}</button>
    </form>
</div>
@endsection
