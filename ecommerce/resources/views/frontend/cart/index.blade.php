@extends('layouts.app')

@section('title', __('shop.cart'))

@section('content')
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
    <h1 class="text-2xl font-extrabold text-gray-900 mb-8">{{ __('shop.cart') }}</h1>

    @if(empty($lines) || count($lines) === 0)
        <div class="bg-white rounded-3xl border border-gray-100 card-shadow py-20 text-center">
            <svg class="w-16 h-16 mx-auto mb-5 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 2.3c-.6.6-.2 1.7.7 1.7H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
            <h2 class="text-lg font-semibold text-gray-900">{{ __('shop.empty_cart') }}</h2>
            <p class="text-gray-500 mt-1">{{ __('shop.empty_cart_desc') }}</p>
            <a href="{{ route('products.index') }}" class="inline-flex mt-6 rounded-full bg-gray-900 text-white font-semibold px-7 py-3 hover:bg-indigo-600 transition">{{ __('shop.continue_shopping') }}</a>
        </div>
    @else
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {{-- Lines --}}
            <div class="lg:col-span-2 space-y-4">
                @foreach($lines as $line)
                    @php $product = $line['product']; @endphp
                    <div class="bg-white rounded-2xl border border-gray-100 card-shadow p-4 flex gap-4 items-center">
                        <a href="{{ route('products.show', $product->slug) }}" class="h-24 w-24 flex-shrink-0 rounded-xl overflow-hidden bg-gray-50">
                            @if($product->main_image)
                                <img src="{{ asset('storage/'.$product->main_image) }}" alt="{{ $product->name }}" class="h-full w-full object-cover">
                            @endif
                        </a>
                        <div class="flex-1 min-w-0">
                            <a href="{{ route('products.show', $product->slug) }}" class="font-semibold text-gray-900 hover:text-indigo-600 line-clamp-1">{{ $product->name }}</a>
                            <p class="text-sm text-gray-500 mt-0.5">{{ money($product->effective_price) }}</p>

                            <div class="flex items-center gap-4 mt-3 flex-wrap">
                                <form action="{{ route('cart.update') }}" method="POST" class="inline-flex items-center gap-2">
                                    @csrf @method('PATCH')
                                    <input type="hidden" name="product_id" value="{{ $product->id }}">
                                    <input type="number" name="quantity" value="{{ $line['qty'] }}" min="1" class="w-20 rounded-lg border-gray-200 text-sm">
                                    <button type="submit" class="text-sm font-semibold text-indigo-600 hover:text-indigo-800">{{ __('shop.update_cart') }}</button>
                                </form>
                                <form action="{{ route('cart.save', $product->id) }}" method="POST" class="inline">
                                    @csrf
                                    <button type="submit" class="text-sm text-gray-500 hover:text-gray-700">{{ __('shop.save_for_later') }}</button>
                                </form>
                                <form action="{{ route('cart.remove', $product->id) }}" method="POST" class="inline">
                                    @csrf @method('DELETE')
                                    <button type="submit" class="text-sm text-rose-500 hover:text-rose-700">{{ __('shop.remove') }}</button>
                                </form>
                            </div>
                        </div>
                        <div class="text-end font-bold text-gray-900 whitespace-nowrap">{{ money($line['line_total']) }}</div>
                    </div>
                @endforeach

                {{-- Coupon --}}
                <div class="bg-white rounded-2xl border border-gray-100 card-shadow p-5">
                    @if(!empty($summary['coupon']) || session('coupon'))
                        @php $couponCode = $summary['coupon'] ?? session('coupon'); @endphp
                        <div class="flex items-center justify-between">
                            <div class="text-sm">
                                <span class="text-gray-500">{{ __('shop.applied_coupon') }}:</span>
                                <span class="font-semibold text-emerald-600">{{ is_array($couponCode) ? ($couponCode['code'] ?? '') : $couponCode }}</span>
                            </div>
                            <form action="{{ route('cart.coupon.remove') }}" method="POST">
                                @csrf @method('DELETE')
                                <button type="submit" class="text-sm text-rose-500 hover:text-rose-700">{{ __('shop.remove') }}</button>
                            </form>
                        </div>
                    @else
                        <p class="text-sm font-medium text-gray-700 mb-2">{{ __('shop.have_coupon') }}</p>
                        <form action="{{ route('cart.coupon') }}" method="POST" class="flex gap-2">
                            @csrf
                            <input type="text" name="code" placeholder="{{ __('shop.coupon_code') }}" class="flex-1 rounded-full border-gray-200 text-sm">
                            <button type="submit" class="rounded-full bg-gray-900 text-white text-sm font-semibold px-6 hover:bg-indigo-600 transition">{{ __('shop.apply') }}</button>
                        </form>
                    @endif
                </div>
            </div>

            {{-- Summary --}}
            <div>
                <div class="bg-white rounded-2xl border border-gray-100 card-shadow p-6 sticky top-20 space-y-4">
                    <h2 class="text-lg font-bold text-gray-900">{{ __('shop.order_summary') }}</h2>
                    <dl class="space-y-2 text-sm">
                        <div class="flex justify-between"><dt class="text-gray-500">{{ __('shop.subtotal') }}</dt><dd class="font-medium">{{ money($summary['subtotal'] ?? 0) }}</dd></div>
                        @if(($summary['discount'] ?? 0) > 0)
                            <div class="flex justify-between text-emerald-600"><dt>{{ __('shop.discount') }}</dt><dd>- {{ money($summary['discount']) }}</dd></div>
                        @endif
                        <div class="flex justify-between"><dt class="text-gray-500">{{ __('shop.tax') }}</dt><dd class="font-medium">{{ money($summary['tax'] ?? 0) }}</dd></div>
                        <div class="flex justify-between"><dt class="text-gray-500">{{ __('shop.shipping') }}</dt><dd class="font-medium">{{ ($summary['shipping'] ?? 0) > 0 ? money($summary['shipping']) : __('shop.free') }}</dd></div>
                    </dl>
                    <div class="border-t border-gray-100 pt-4 flex justify-between items-baseline">
                        <span class="font-bold text-gray-900">{{ __('shop.total') }}</span>
                        <span class="text-xl font-extrabold text-indigo-600">{{ money($summary['total'] ?? 0) }}</span>
                    </div>
                    <a href="{{ route('checkout.index') }}" class="block w-full text-center rounded-full bg-gray-900 text-white font-semibold py-3 hover:bg-indigo-600 transition">{{ __('shop.proceed_to_checkout') }}</a>
                    <a href="{{ route('products.index') }}" class="block w-full text-center text-sm text-gray-500 hover:text-gray-700">{{ __('shop.continue_shopping') }}</a>
                </div>
            </div>
        </div>
    @endif
</div>
@endsection
