@extends('layouts.app')

@section('title', $product->name)

@section('content')
@php
    $gallery = [];
    if ($product->main_image) { $gallery[] = $product->main_image; }
    foreach (($product->gallery_images ?? []) as $g) { $gallery[] = $g; }
    if (empty($gallery)) { $gallery[] = null; }
    $waNumber = preg_replace('/\D/', '', (string) setting('whatsapp_number'));
    $shareUrl = urlencode(route('products.show', $product->slug));
    $shareText = urlencode($product->name);
@endphp

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
    <nav class="text-sm text-gray-400 mb-6 flex items-center gap-2">
        <a href="{{ route('home') }}" class="hover:text-indigo-600">{{ __('shop.home') }}</a>
        <span>/</span>
        <a href="{{ route('products.index') }}" class="hover:text-indigo-600">{{ __('shop.products') }}</a>
        <span>/</span>
        <span class="text-gray-600">{{ $product->name }}</span>
    </nav>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-10" x-data="{ current: '{{ $gallery[0] ? asset('storage/'.$gallery[0]) : '' }}' }">
        {{-- Gallery --}}
        <div class="space-y-4">
            <div class="relative aspect-square rounded-3xl overflow-hidden bg-gray-50 border border-gray-100 group">
                <template x-if="current">
                    <img :src="current" alt="{{ $product->name }}" class="h-full w-full object-cover transition duration-500 group-hover:scale-110">
                </template>
                @unless($gallery[0])
                    <div class="h-full w-full flex items-center justify-center text-gray-300">
                        <svg class="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 16l4.6-4.6a2 2 0 012.8 0L16 16m-2-2l1.6-1.6a2 2 0 012.8 0L20 14M4 6h16v12H4z"/></svg>
                    </div>
                @endunless
            </div>
            @if(count($gallery) > 1)
                <div class="grid grid-cols-5 gap-3">
                    @foreach($gallery as $img)
                        @if($img)
                            <button @click="current = '{{ asset('storage/'.$img) }}'"
                                    :class="current === '{{ asset('storage/'.$img) }}' ? 'ring-2 ring-indigo-500' : 'ring-1 ring-gray-100'"
                                    class="aspect-square rounded-xl overflow-hidden bg-gray-50">
                                <img src="{{ asset('storage/'.$img) }}" alt="" class="h-full w-full object-cover">
                            </button>
                        @endif
                    @endforeach
                </div>
            @endif
        </div>

        {{-- Details --}}
        <div class="space-y-6">
            @if($product->category)
                <span class="text-xs uppercase tracking-wide text-indigo-500 font-semibold">{{ $product->category->name }}</span>
            @endif
            <h1 class="text-3xl font-extrabold text-gray-900">{{ $product->name }}</h1>

            <x-price :product="$product" class="!text-2xl" />

            <div class="flex items-center gap-3 text-sm">
                @if($product->in_stock)
                    <span class="inline-flex items-center gap-1.5 text-emerald-600 font-medium"><span class="h-2 w-2 rounded-full bg-emerald-500"></span>{{ __('shop.in_stock') }}</span>
                @else
                    <span class="inline-flex items-center gap-1.5 text-rose-600 font-medium"><span class="h-2 w-2 rounded-full bg-rose-500"></span>{{ __('shop.out_of_stock') }}</span>
                @endif
                <span class="text-gray-300">|</span>
                <span class="text-gray-500">{{ __('shop.sku') }}: {{ $product->sku }}</span>
            </div>

            @if($product->short_description)
                <p class="text-gray-600 leading-relaxed">{{ $product->short_description }}</p>
            @endif

            {{-- Add to cart --}}
            @if($product->in_stock)
                <form action="{{ route('cart.add') }}" method="POST" x-data="{ qty: 1 }" class="flex flex-wrap items-center gap-4">
                    @csrf
                    <input type="hidden" name="product_id" value="{{ $product->id }}">
                    <input type="hidden" name="quantity" :value="qty">
                    <div class="inline-flex items-center border border-gray-200 rounded-full overflow-hidden">
                        <button type="button" @click="qty = Math.max(1, qty - 1)" class="px-4 py-2.5 text-gray-500 hover:bg-gray-50">&minus;</button>
                        <span class="px-4 font-semibold w-12 text-center" x-text="qty"></span>
                        <button type="button" @click="qty = Math.min({{ $product->stock }}, qty + 1)" class="px-4 py-2.5 text-gray-500 hover:bg-gray-50">+</button>
                    </div>
                    <button type="submit" class="flex-1 min-w-[180px] inline-flex items-center justify-center gap-2 rounded-full bg-gray-900 text-white font-semibold px-8 py-3 hover:bg-indigo-600 transition">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M17 17a2 2 0 100 4 2 2 0 000-4zM9 17a2 2 0 100 4 2 2 0 000-4z"/></svg>
                        {{ __('shop.add_to_cart') }}
                    </button>
                </form>
            @endif

            {{-- WhatsApp --}}
            @if($waNumber)
                <a href="https://wa.me/{{ $waNumber }}?text={{ urlencode($product->name.' - '.route('products.show', $product->slug)) }}" target="_blank" rel="noopener"
                   class="inline-flex items-center gap-2 rounded-full bg-emerald-500 text-white font-semibold px-6 py-3 hover:bg-emerald-600 transition">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20 11.9a8 8 0 01-11.7 7.1L4 20l1.1-4.2A8 8 0 1120 11.9zm-8-6.4a6.4 6.4 0 00-5.4 9.8l-.6 2.3 2.4-.6a6.4 6.4 0 103.6-11.5zm3.7 8.1c-.2-.1-1.2-.6-1.4-.6-.2-.1-.3-.1-.4.1l-.6.7c-.1.1-.2.2-.4.1a5.2 5.2 0 01-2.6-2.2c-.2-.3.2-.3.5-1 .1-.1 0-.3 0-.4l-.6-1.3c-.1-.3-.3-.3-.4-.3h-.4c-.1 0-.4.1-.5.3-.2.2-.7.6-.7 1.6s.7 1.9.8 2c.1.2 1.4 2.2 3.5 3 .5.2.9.4 1.2.5.5.1 1 .1 1.3.1.4-.1 1.2-.5 1.3-1 .2-.5.2-.9.1-1z"/></svg>
                    {{ __('shop.whatsapp_inquiry') }}
                </a>
            @endif

            {{-- Share --}}
            <div class="flex items-center gap-3 pt-2 border-t border-gray-100">
                <span class="text-sm text-gray-500">{{ __('shop.share') }}:</span>
                <a href="https://www.facebook.com/sharer/sharer.php?u={{ $shareUrl }}" target="_blank" rel="noopener" class="h-9 w-9 rounded-full bg-gray-100 hover:bg-indigo-100 text-gray-600 flex items-center justify-center transition">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M22 12a10 10 0 10-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0022 12z"/></svg>
                </a>
                <a href="https://twitter.com/intent/tweet?url={{ $shareUrl }}&text={{ $shareText }}" target="_blank" rel="noopener" class="h-9 w-9 rounded-full bg-gray-100 hover:bg-indigo-100 text-gray-600 flex items-center justify-center transition">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.9 2H22l-7.5 8.6L23.3 22h-6.8l-5.3-6.9L5.1 22H2l8-9.2L1 2h7l4.8 6.3L18.9 2z"/></svg>
                </a>
                <a href="https://wa.me/?text={{ $shareText }}%20{{ $shareUrl }}" target="_blank" rel="noopener" class="h-9 w-9 rounded-full bg-gray-100 hover:bg-emerald-100 text-gray-600 flex items-center justify-center transition">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20 11.9a8 8 0 01-11.7 7.1L4 20l1.1-4.2A8 8 0 1120 11.9z"/></svg>
                </a>
            </div>
        </div>
    </div>

    {{-- Description & specs --}}
    @if($product->description)
        <div class="mt-14 bg-white rounded-3xl border border-gray-100 card-shadow p-8">
            <h2 class="text-xl font-extrabold text-gray-900 mb-4">{{ __('shop.description') }}</h2>
            <div class="prose max-w-none text-gray-600 leading-relaxed whitespace-pre-line">{{ $product->description }}</div>
        </div>
    @endif

    {{-- Related --}}
    @if(isset($related) && count($related))
        <section class="mt-14">
            <h2 class="text-2xl font-extrabold text-gray-900 mb-8">{{ __('shop.related_products') }}</h2>
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-5">
                @foreach($related as $rel)
                    <x-product-card :product="$rel" />
                @endforeach
            </div>
        </section>
    @endif
</div>
@endsection
