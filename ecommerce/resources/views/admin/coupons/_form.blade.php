@php
    $coupon = $coupon ?? null;
    $fmt = fn($d) => $d ? \Illuminate\Support\Carbon::parse($d)->format('Y-m-d\TH:i') : '';
@endphp

<div class="bg-white rounded-2xl border border-gray-100 card-shadow p-6 space-y-5 max-w-2xl">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.code') }}</label>
            <input type="text" name="code" value="{{ old('code', $coupon->code ?? '') }}" class="w-full rounded-xl border-gray-200 uppercase @error('code') border-rose-400 @enderror">
            @error('code')<p class="text-xs text-rose-500 mt-1">{{ $message }}</p>@enderror
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.type') }}</label>
            <select name="type" class="w-full rounded-xl border-gray-200">
                <option value="percentage" @selected(old('type', $coupon->type ?? '') === 'percentage')>{{ __('admin.percentage') }}</option>
                <option value="fixed" @selected(old('type', $coupon->type ?? '') === 'fixed')>{{ __('admin.fixed') }}</option>
            </select>
        </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.value') }}</label>
            <input type="number" step="0.01" name="value" value="{{ old('value', $coupon->value ?? '') }}" class="w-full rounded-xl border-gray-200 @error('value') border-rose-400 @enderror">
            @error('value')<p class="text-xs text-rose-500 mt-1">{{ $message }}</p>@enderror
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.min_order_amount') }}</label>
            <input type="number" step="0.01" name="min_order_amount" value="{{ old('min_order_amount', $coupon->min_order_amount ?? '') }}" class="w-full rounded-xl border-gray-200">
        </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.start_date') }}</label>
            <input type="datetime-local" name="start_date" value="{{ old('start_date', $fmt($coupon->start_date ?? null)) }}" class="w-full rounded-xl border-gray-200">
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.end_date') }}</label>
            <input type="datetime-local" name="end_date" value="{{ old('end_date', $fmt($coupon->end_date ?? null)) }}" class="w-full rounded-xl border-gray-200">
        </div>
    </div>

    <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.usage_limit') }}</label>
        <input type="number" name="usage_limit" value="{{ old('usage_limit', $coupon->usage_limit ?? '') }}" class="w-full rounded-xl border-gray-200">
    </div>

    <label class="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" name="status" value="1" @checked(old('status', $coupon->status ?? true)) class="rounded border-gray-300 text-indigo-600">
        {{ __('admin.active') }}
    </label>
</div>

<div class="flex items-center gap-3 mt-6">
    <button type="submit" class="rounded-full bg-gray-900 text-white font-semibold px-8 py-3 hover:bg-indigo-600 transition">{{ __('admin.save') }}</button>
    <a href="{{ route('admin.coupons.index') }}" class="rounded-full border border-gray-200 text-gray-600 font-semibold px-8 py-3 hover:bg-gray-50 transition">{{ __('admin.cancel') }}</a>
</div>
