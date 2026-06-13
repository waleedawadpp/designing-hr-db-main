<!DOCTYPE html>
<html dir="{{ current_dir() }}" lang="{{ app()->getLocale() }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title', __('admin.admin_panel')) &middot; {{ setting('store_name', config('app.name')) }}</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
    @stack('styles')
</head>
<body class="font-sans antialiased bg-gray-100 text-gray-800">
<div x-data="{ sidebar: false }" class="min-h-screen">
    @php
        $nav = [
            ['route' => 'admin.dashboard', 'label' => 'dashboard', 'can' => 'view dashboard', 'icon' => 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'],
            ['route' => 'admin.products.index', 'label' => 'products', 'can' => 'manage products', 'icon' => 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'],
            ['route' => 'admin.categories.index', 'label' => 'categories', 'can' => 'manage categories', 'icon' => 'M7 7h.01M7 3h5a2 2 0 011.42.59l7 7a2 2 0 010 2.82l-5 5a2 2 0 01-2.82 0l-7-7A2 2 0 014 9V4a1 1 0 011-1z'],
            ['route' => 'admin.orders.index', 'label' => 'orders', 'can' => 'manage orders', 'icon' => 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2'],
            ['route' => 'admin.coupons.index', 'label' => 'coupons', 'can' => 'manage coupons', 'icon' => 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z'],
            ['route' => 'admin.banners.index', 'label' => 'banners', 'can' => 'manage banners', 'icon' => 'M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 11l4.6-4.6a2 2 0 012.8 0L16 16'],
            ['route' => 'admin.settings.edit', 'label' => 'settings', 'can' => 'manage settings', 'icon' => 'M10.32 4.32a2 2 0 013.36 0l.5.86a2 2 0 002.27 1.06l1-.27a2 2 0 012.44 2.44l-.27 1a2 2 0 001.06 2.27l.86.5a2 2 0 010 3.36l-.86.5a2 2 0 00-1.06 2.27l.27 1a2 2 0 01-2.44 2.44l-1-.27a2 2 0 00-2.27 1.06l-.5.86a2 2 0 01-3.36 0l-.5-.86a2 2 0 00-2.27-1.06l-1 .27a2 2 0 01-2.44-2.44l.27-1a2 2 0 00-1.06-2.27l-.86-.5a2 2 0 010-3.36l.86-.5a2 2 0 001.06-2.27l-.27-1a2 2 0 012.44-2.44l1 .27a2 2 0 002.27-1.06l.5-.86zM12 15a3 3 0 100-6 3 3 0 000 6z'],
        ];
    @endphp

    {{-- Sidebar --}}
    <aside :class="sidebar ? 'translate-x-0' : (document.dir === 'rtl' ? 'translate-x-full' : '-translate-x-full')"
           class="fixed inset-y-0 z-40 w-64 bg-gray-900 text-gray-300 transform transition-transform lg:translate-x-0 start-0"
           style="inset-inline-start: 0;">
        <div class="h-16 flex items-center px-6 border-b border-white/10">
            <a href="{{ route('admin.dashboard') }}" class="text-lg font-extrabold text-white">{{ setting('store_name', config('app.name')) }}</a>
        </div>
        <nav class="p-4 space-y-1">
            @foreach($nav as $item)
                @can($item['can'])
                    @php $active = request()->routeIs(str_replace('.index', '', $item['route']).'*') || request()->routeIs($item['route']); @endphp
                    <a href="{{ route($item['route']) }}"
                       class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition {{ $active ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white' }}">
                        <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="{{ $item['icon'] }}"/></svg>
                        {{ __('admin.'.$item['label']) }}
                    </a>
                @endcan
            @endforeach
        </nav>
    </aside>

    {{-- Backdrop (mobile) --}}
    <div x-show="sidebar" @click="sidebar = false" x-transition.opacity x-cloak class="fixed inset-0 bg-black/40 z-30 lg:hidden"></div>

    {{-- Content --}}
    <div class="lg:ms-64">
        {{-- Topbar --}}
        <header class="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
            <button @click="sidebar = !sidebar" class="lg:hidden p-2 rounded-lg hover:bg-gray-100">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>

            <div class="flex items-center gap-4 ms-auto">
                <a href="{{ route('home') }}" target="_blank" class="hidden sm:inline-flex text-sm text-gray-500 hover:text-indigo-600">{{ __('admin.view_store') }}</a>

                {{-- Locale switcher --}}
                <div class="flex items-center gap-1 text-xs font-semibold">
                    <a href="{{ route('locale.switch', 'en') }}" class="{{ app()->getLocale() === 'en' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600' }}">EN</a>
                    <span class="text-gray-300">|</span>
                    <a href="{{ route('locale.switch', 'ar') }}" class="{{ app()->getLocale() === 'ar' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600' }}">ع</a>
                </div>

                {{-- User dropdown --}}
                <div x-data="{ open: false }" class="relative">
                    <button @click="open = !open" class="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <span class="h-9 w-9 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">{{ mb_substr(auth()->user()->name ?? 'A', 0, 1) }}</span>
                        <span class="hidden sm:inline">{{ auth()->user()->name ?? '' }}</span>
                    </button>
                    <div x-show="open" @click.away="open = false" x-transition x-cloak class="absolute end-0 mt-2 w-48 bg-white rounded-xl border border-gray-100 card-shadow py-1 z-30">
                        <a href="{{ route('profile.edit') }}" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">{{ __('admin.profile') }}</a>
                        <form method="POST" action="{{ route('logout') }}">
                            @csrf
                            <button type="submit" class="w-full text-start px-4 py-2 text-sm text-rose-600 hover:bg-rose-50">{{ __('admin.logout') }}</button>
                        </form>
                    </div>
                </div>
            </div>
        </header>

        @include('layouts.partials.frontend.flash')

        <main class="p-4 sm:p-6 lg:p-8">
            @yield('content')
        </main>
    </div>
</div>
@stack('scripts')
</body>
</html>
