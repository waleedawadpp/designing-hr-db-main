@extends('layouts.app')

@section('content')
    {{-- Hero slider --}}
    @if(isset($banners) && count($banners))
        <section x-data="{ active: 0, count: {{ count($banners) }} }"
                 x-init="setInterval(() => active = (active + 1) % count, 6000)"
                 class="relative">
            <div class="relative overflow-hidden">
                @foreach($banners as $i => $banner)
                    <div x-show="active === {{ $i }}" x-transition.opacity.duration.700ms
                         class="relative h-[420px] sm:h-[520px] w-full">
                        @if($banner->image)
                            <img src="{{ asset('storage/'.$banner->image) }}" alt="{{ $banner->title }}" class="absolute inset-0 h-full w-full object-cover">
                        @endif
                        <div class="absolute inset-0 bg-gradient-to-r from-gray-900/70 via-gray-900/40 to-transparent"></div>
                        <div class="relative max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center">
                            <div class="max-w-xl text-white space-y-5">
                                <h1 class="text-4xl sm:text-5xl font-extrabold leading-tight">{{ $banner->title }}</h1>
                                @if($banner->button_link)
                                    <a href="{{ $banner->button_link }}" class="inline-flex items-center gap-2 rounded-full bg-white text-gray-900 font-semibold px-7 py-3 hover:bg-indigo-600 hover:text-white transition">
                                        {{ $banner->button_text ?: __('shop.shop_now') }}
                                    </a>
                                @endif
                            </div>
                        </div>
                    </div>
                @endforeach
            </div>
            {{-- Dots --}}
            <div class="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2">
                @foreach($banners as $i => $banner)
                    <button @click="active = {{ $i }}" :class="active === {{ $i }} ? 'bg-white w-6' : 'bg-white/50 w-2'" class="h-2 rounded-full transition-all"></button>
                @endforeach
            </div>
        </section>
    @else
        <section class="bg-gradient-to-br from-indigo-600 to-purple-700 text-white">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center space-y-6">
                <h1 class="text-4xl sm:text-5xl font-extrabold">{{ setting('store_name', config('app.name')) }}</h1>
                <p class="text-lg text-indigo-100 max-w-2xl mx-auto">{{ __('shop.cta_desc') }}</p>
                <a href="{{ route('products.index') }}" class="inline-flex rounded-full bg-white text-indigo-700 font-semibold px-8 py-3 hover:bg-indigo-50 transition">{{ __('shop.hero_cta') }}</a>
            </div>
        </section>
    @endif

    {{-- Why choose us --}}
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            @php
                $features = [
                    ['icon' => 'M5 13l4 4L19 7', 'title' => 'free_shipping', 'desc' => 'free_shipping_desc'],
                    ['icon' => 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z', 'title' => 'secure_payment', 'desc' => 'secure_payment_desc'],
                    ['icon' => 'M3 10h18M3 10l2-6h14l2 6M3 10v8a2 2 0 002 2h14a2 2 0 002-2v-8', 'title' => 'easy_returns', 'desc' => 'easy_returns_desc'],
                    ['icon' => 'M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728m12.728 0L5.636 18.364', 'title' => 'support_247', 'desc' => 'support_247_desc'],
                ];
            @endphp
            @foreach($features as $f)
                <div class="bg-white rounded-2xl border border-gray-100 p-6 text-center card-shadow">
                    <div class="mx-auto h-12 w-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="{{ $f['icon'] }}"/></svg>
                    </div>
                    <h3 class="font-semibold text-gray-900">{{ __('shop.'.$f['title']) }}</h3>
                    <p class="text-sm text-gray-500 mt-1">{{ __('shop.'.$f['desc']) }}</p>
                </div>
            @endforeach
        </div>
    </section>

    {{-- Categories --}}
    @if(isset($categories) && count($categories))
        <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div class="flex items-center justify-between mb-8">
                <h2 class="text-2xl font-extrabold text-gray-900">{{ __('shop.shop_by_category') }}</h2>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                @foreach($categories as $category)
                    <a href="{{ route('products.index', ['category' => $category->id]) }}" class="group block bg-white rounded-2xl border border-gray-100 overflow-hidden card-shadow hover:-translate-y-1 transition">
                        <div class="aspect-square bg-gray-50 overflow-hidden">
                            @if($category->image)
                                <img src="{{ asset('storage/'.$category->image) }}" alt="{{ $category->name }}" class="h-full w-full object-cover group-hover:scale-105 transition duration-500">
                            @else
                                <div class="h-full w-full flex items-center justify-center text-indigo-200 text-2xl font-bold">{{ mb_substr($category->name, 0, 1) }}</div>
                            @endif
                        </div>
                        <div class="p-3 text-center">
                            <span class="text-sm font-semibold text-gray-800 group-hover:text-indigo-600 line-clamp-1">{{ $category->name }}</span>
                        </div>
                    </a>
                @endforeach
            </div>
        </section>
    @endif

    {{-- Featured products --}}
    @if(isset($featured) && count($featured))
        <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div class="flex items-center justify-between mb-8">
                <h2 class="text-2xl font-extrabold text-gray-900">{{ __('shop.featured_products') }}</h2>
                <a href="{{ route('products.index') }}" class="text-sm font-semibold text-indigo-600 hover:text-indigo-800">{{ __('shop.view_all') }} &rarr;</a>
            </div>
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-5">
                @foreach($featured as $product)
                    <x-product-card :product="$product" />
                @endforeach
            </div>
        </section>
    @endif

    {{-- Promotional banner --}}
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div class="rounded-3xl bg-gradient-to-r from-gray-900 to-indigo-800 text-white px-8 sm:px-14 py-14 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div class="space-y-2 text-center sm:text-start">
                <h3 class="text-3xl font-extrabold">{{ __('shop.cta_title') }}</h3>
                <p class="text-indigo-100">{{ __('shop.cta_desc') }}</p>
            </div>
            <a href="{{ route('products.index') }}" class="inline-flex rounded-full bg-white text-gray-900 font-semibold px-8 py-3 hover:bg-indigo-50 transition flex-shrink-0">{{ __('shop.shop_now') }}</a>
        </div>
    </section>

    {{-- Testimonials --}}
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 class="text-2xl font-extrabold text-gray-900 text-center mb-10">{{ __('shop.testimonials') }}</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            @foreach(['testimonial_1', 'testimonial_2', 'testimonial_3'] as $i => $t)
                <div class="bg-white rounded-2xl border border-gray-100 p-7 card-shadow space-y-4">
                    <div class="flex gap-0.5 text-amber-400">
                        @for($s = 0; $s < 5; $s++)
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.42 4.37a1 1 0 00.95.69h4.6c.97 0 1.37 1.24.59 1.81l-3.72 2.7a1 1 0 00-.36 1.12l1.42 4.37c.3.92-.76 1.69-1.54 1.12l-3.72-2.7a1 1 0 00-1.18 0l-3.72 2.7c-.78.57-1.84-.2-1.54-1.12l1.42-4.37a1 1 0 00-.36-1.12l-3.72-2.7c-.78-.57-.38-1.81.59-1.81h4.6a1 1 0 00.95-.69L9.05 2.93z"/></svg>
                        @endfor
                    </div>
                    <p class="text-gray-600 text-sm leading-relaxed">{{ __('shop.'.$t) }}</p>
                    <div class="flex items-center gap-3 pt-2">
                        <div class="h-10 w-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">{{ chr(65 + $i) }}</div>
                        <div>
                            <p class="text-sm font-semibold text-gray-900">{{ __('shop.happy_customer') }}</p>
                            <p class="text-xs text-gray-400">{{ __('shop.review') }}</p>
                        </div>
                    </div>
                </div>
            @endforeach
        </div>
    </section>

    {{-- Newsletter CTA --}}
    <section class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center space-y-5">
        <h2 class="text-2xl font-extrabold text-gray-900">{{ __('shop.newsletter') }}</h2>
        <p class="text-gray-500">{{ __('shop.newsletter_desc') }}</p>
        <form onsubmit="return false" class="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input type="email" placeholder="{{ __('shop.your_email') }}" class="flex-1 rounded-full border-gray-200 bg-white px-5 py-3 text-sm focus:ring-indigo-400 focus:border-indigo-400">
            <button type="submit" class="rounded-full bg-gray-900 text-white font-semibold px-7 py-3 hover:bg-indigo-600 transition">{{ __('shop.subscribe') }}</button>
        </form>
    </section>
@endsection
