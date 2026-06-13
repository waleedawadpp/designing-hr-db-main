@extends('layouts.app')

@section('title', __('shop.order_status'))

@php
    $badge = match($order->status_color) {
        'yellow' => 'bg-amber-100 text-amber-700',
        'blue' => 'bg-blue-100 text-blue-700',
        'indigo' => 'bg-indigo-100 text-indigo-700',
        'purple' => 'bg-purple-100 text-purple-700',
        'green' => 'bg-emerald-100 text-emerald-700',
        'red' => 'bg-rose-100 text-rose-700',
        default => 'bg-gray-100 text-gray-700',
    };
@endphp

@section('content')
<div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
            <h1 class="text-2xl font-extrabold text-gray-900">{{ __('shop.order_number') }}: {{ $order->order_number }}</h1>
            <p class="text-sm text-gray-500 mt-1">{{ __('shop.order_date') }}: {{ $order->created_at->format('Y-m-d H:i') }}</p>
        </div>
        <span class="inline-flex self-start items-center rounded-full px-4 py-1.5 text-sm font-semibold {{ $badge }}">
            {{ __('shop.status_'.$order->status) }}
        </span>
    </div>

    <div class="bg-white rounded-3xl border border-gray-100 card-shadow p-7">
        <h2 class="text-lg font-bold text-gray-900 mb-4">{{ __('shop.items') }}</h2>
        <div class="divide-y divide-gray-100">
            @foreach($order->items as $item)
                <div class="flex items-center justify-between py-3 text-sm">
                    <div>
                        <p class="font-medium text-gray-800">{{ $item->product_name }}</p>
                        <p class="text-gray-400">{{ __('shop.qty') }}: {{ $item->quantity }} &times; {{ money($item->unit_price) }}</p>
                    </div>
                    <span class="font-semibold">{{ money($item->total) }}</span>
                </div>
            @endforeach
        </div>
        <dl class="space-y-2 text-sm border-t border-gray-100 mt-4 pt-4">
            <div class="flex justify-between"><dt class="text-gray-500">{{ __('shop.subtotal') }}</dt><dd class="font-medium">{{ money($order->subtotal) }}</dd></div>
            @if($order->discount > 0)
                <div class="flex justify-between text-emerald-600"><dt>{{ __('shop.discount') }}</dt><dd>- {{ money($order->discount) }}</dd></div>
            @endif
            <div class="flex justify-between"><dt class="text-gray-500">{{ __('shop.tax') }}</dt><dd class="font-medium">{{ money($order->tax) }}</dd></div>
            <div class="flex justify-between"><dt class="text-gray-500">{{ __('shop.shipping') }}</dt><dd class="font-medium">{{ $order->shipping > 0 ? money($order->shipping) : __('shop.free') }}</dd></div>
            <div class="flex justify-between border-t border-gray-100 pt-2 mt-2"><dt class="font-bold text-gray-900">{{ __('shop.total') }}</dt><dd class="font-extrabold text-indigo-600">{{ money($order->total) }}</dd></div>
        </dl>
    </div>

    <div class="flex flex-col sm:flex-row gap-3 mt-8">
        <a href="{{ route('orders.invoice', $order->order_number) }}" class="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-gray-900 text-white font-semibold py-3 hover:bg-indigo-600 transition">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            {{ __('shop.download_invoice') }}
        </a>
        <a href="{{ route('products.index') }}" class="flex-1 inline-flex items-center justify-center rounded-full border border-gray-200 text-gray-700 font-semibold py-3 hover:bg-gray-50 transition">{{ __('shop.continue_shopping') }}</a>
    </div>
</div>
@endsection
