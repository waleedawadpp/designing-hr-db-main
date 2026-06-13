@extends('layouts.app')

@section('title', __('shop.products'))

@section('content')
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
    <div class="flex flex-col lg:flex-row gap-8">
        {{-- Sidebar filters --}}
        <aside class="lg:w-64 flex-shrink-0">
            <form action="{{ route('products.index') }}" method="GET" class="bg-white rounded-2xl border border-gray-100 card-shadow p-6 space-y-6 sticky top-20">
                @if(request('search'))
                    <input type="hidden" name="search" value="{{ request('search') }}">
                @endif
                @if(request('sort'))
                    <input type="hidden" name="sort" value="{{ request('sort') }}">
                @endif

                <div>
                    <h3 class="font-semibold text-gray-900 mb-3">{{ __('shop.categories') }}</h3>
                    <ul class="space-y-1 text-sm">
                        <li>
                            <a href="{{ route('products.index', array_merge(request()->except(['category','page']))) }}"
                               class="block px-3 py-1.5 rounded-lg {{ empty($filters['category'] ?? null) ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-600 hover:bg-gray-50' }}">
                                {{ __('shop.all_categories') }}
                            </a>
                        </li>
                        @foreach(($categories ?? []) as $cat)
                            <li>
                                <a href="{{ route('products.index', array_merge(request()->except(['page']), ['category' => $cat->id])) }}"
                                   class="block px-3 py-1.5 rounded-lg {{ (string)($filters['category'] ?? '') === (string)$cat->id ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-600 hover:bg-gray-50' }}">
                                    {{ $cat->name }}
                                </a>
                            </li>
                        @endforeach
                    </ul>
                </div>

                <div>
                    <h3 class="font-semibold text-gray-900 mb-3">{{ __('shop.price') }}</h3>
                    <div class="flex items-center gap-2">
                        <input type="number" name="min_price" value="{{ $filters['min_price'] ?? '' }}" placeholder="{{ __('shop.min_price') }}" class="w-full rounded-lg border-gray-200 text-sm">
                        <span class="text-gray-400">-</span>
                        <input type="number" name="max_price" value="{{ $filters['max_price'] ?? '' }}" placeholder="{{ __('shop.max_price') }}" class="w-full rounded-lg border-gray-200 text-sm">
                    </div>
                </div>

                <div class="flex flex-col gap-2">
                    <button type="submit" class="w-full rounded-full bg-gray-900 text-white text-sm font-semibold py-2.5 hover:bg-indigo-600 transition">{{ __('shop.filter') }}</button>
                    <a href="{{ route('products.index') }}" class="w-full text-center rounded-full border border-gray-200 text-gray-600 text-sm font-semibold py-2.5 hover:bg-gray-50 transition">{{ __('shop.clear_filters') }}</a>
                </div>
            </form>
        </aside>

        {{-- Main --}}
        <div class="flex-1">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 class="text-2xl font-extrabold text-gray-900">{{ __('shop.products') }}</h1>
                    <p class="text-sm text-gray-500">{{ $products->total() }} {{ __('shop.items') }}</p>
                </div>

                <form action="{{ route('products.index') }}" method="GET" class="flex items-center gap-2">
                    @foreach(request()->except(['sort','page']) as $k => $v)
                        <input type="hidden" name="{{ $k }}" value="{{ $v }}">
                    @endforeach
                    <label class="text-sm text-gray-500">{{ __('shop.sort_by') }}</label>
                    <select name="sort" onchange="this.form.submit()" class="rounded-full border-gray-200 text-sm focus:ring-indigo-400 focus:border-indigo-400">
                        <option value="newest" @selected(($filters['sort'] ?? 'newest') === 'newest')>{{ __('shop.newest') }}</option>
                        <option value="price_asc" @selected(($filters['sort'] ?? '') === 'price_asc')>{{ __('shop.price_low_high') }}</option>
                        <option value="price_desc" @selected(($filters['sort'] ?? '') === 'price_desc')>{{ __('shop.price_high_low') }}</option>
                        <option value="popularity" @selected(($filters['sort'] ?? '') === 'popularity')>{{ __('shop.popularity') }}</option>
                    </select>
                </form>
            </div>

            @if(count($products))
                <div class="grid grid-cols-2 lg:grid-cols-3 gap-5">
                    @foreach($products as $product)
                        <x-product-card :product="$product" />
                    @endforeach
                </div>
                <div class="mt-10">
                    {{ $products->withQueryString()->links() }}
                </div>
            @else
                <div class="bg-white rounded-2xl border border-gray-100 card-shadow py-20 text-center text-gray-400">
                    <svg class="w-14 h-14 mx-auto mb-4 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                    <p class="font-medium">{{ __('shop.no_products') }}</p>
                </div>
            @endif
        </div>
    </div>
</div>
@endsection
