@extends('layouts.app')

@section('title', __('shop.track_order'))

@section('content')
<div class="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-16">
    <div class="bg-white rounded-3xl border border-gray-100 card-shadow p-8 text-center">
        <div class="mx-auto h-14 w-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-5">
            <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM20 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8h4l3 3v5m0 0h-2"/></svg>
        </div>
        <h1 class="text-2xl font-extrabold text-gray-900">{{ __('shop.track_order') }}</h1>
        <p class="text-gray-500 text-sm mt-2">{{ __('shop.track_order_desc') }}</p>

        <form action="{{ route('orders.track.submit') }}" method="POST" class="mt-6 space-y-4">
            @csrf
            <input type="text" name="order_number" value="{{ old('order_number') }}" placeholder="{{ __('shop.order_number') }}"
                   class="w-full rounded-full border-gray-200 text-center focus:ring-indigo-400 focus:border-indigo-400 @error('order_number') border-rose-400 @enderror">
            @error('order_number')<p class="text-xs text-rose-500">{{ $message }}</p>@enderror
            <button type="submit" class="w-full rounded-full bg-gray-900 text-white font-semibold py-3 hover:bg-indigo-600 transition">{{ __('shop.track_order') }}</button>
        </form>
    </div>
</div>
@endsection
