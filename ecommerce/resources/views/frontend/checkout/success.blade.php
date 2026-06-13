@extends('layouts.app')

@section('title', __('shop.order_placed'))

@section('content')
<div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
    <div class="text-center mb-10">
        <div class="mx-auto h-20 w-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-5">
            <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
        </div>
        <h1 class="text-3xl font-extrabold text-gray-900">{{ __('shop.thank_you') }}</h1>
        <p class="text-gray-500 mt-2">{{ __('shop.order_placed_desc') }}</p>
        <p class="mt-4 inline-flex items-center gap-2 rounded-full bg-indigo-50 text-indigo-700 font-semibold px-5 py-2">
            {{ __('shop.order_number') }}: {{ $order->order_number }}
        </p>
    </div>

    <div class="bg-white rounded-3xl border border-gray-100 card-shadow p-7">
        <h2 class="text-lg font-bold text-gray-900 mb-4">{{ __('shop.order_summary') }}</h2>
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
        <a href="{{ route('orders.track', $order->order_number) }}" class="flex-1 inline-flex items-center justify-center rounded-full border border-gray-200 text-gray-700 font-semibold py-3 hover:bg-gray-50 transition">{{ __('shop.track_order') }}</a>
        <a href="{{ route('products.index') }}" class="flex-1 inline-flex items-center justify-center rounded-full border border-gray-200 text-gray-700 font-semibold py-3 hover:bg-gray-50 transition">{{ __('shop.continue_shopping') }}</a>
    </div>
</div>
@endsection
