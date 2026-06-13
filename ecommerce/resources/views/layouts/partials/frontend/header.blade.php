<header x-data="{ mobile: false, searchOpen: false }" class="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-100">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16 gap-4">
            {{-- Logo --}}
            <a href="{{ route('home') }}" class="flex items-center gap-2 flex-shrink-0">
                @if(setting('logo'))
                    <img src="{{ asset('storage/'.setting('logo')) }}" alt="{{ setting('store_name') }}" class="h-9 w-auto">
                @else
                    <span class="text-xl font-extrabold tracking-tight text-gray-900">{{ setting('store_name', config('app.name')) }}</span>
                @endif
            </a>

            {{-- Desktop menu --}}
            <nav class="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
                <a href="{{ route('home') }}" class="hover:text-indigo-600 transition">{{ __('shop.home') }}</a>
                <a href="{{ route('products.index') }}" class="hover:text-indigo-600 transition">{{ __('shop.products') }}</a>
                <a href="{{ route('orders.track.form') }}" class="hover:text-indigo-600 transition">{{ __('shop.track_order') }}</a>
            </nav>

            {{-- Search (desktop) --}}
            <form action="{{ route('products.index') }}" method="GET" class="hidden lg:flex flex-1 max-w-xs">
                <div class="relative w-full">
                    <input type="text" name="search" value="{{ request('search') }}" placeholder="{{ __('shop.search_placeholder') }}"
                           class="w-full rounded-full border-gray-200 bg-gray-50 ps-10 pe-4 py-2 text-sm focus:border-indigo-400 focus:ring-indigo-400">
                    <svg class="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"/></svg>
                </div>
            </form>

            {{-- Right actions --}}
            <div class="flex items-center gap-2 sm:gap-4">
                {{-- Language switcher --}}
                <div class="hidden sm:flex items-center gap-1 text-xs font-semibold">
                    <a href="{{ route('locale.switch', 'en') }}" class="{{ app()->getLocale() === 'en' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600' }}">EN</a>
                    <span class="text-gray-300">|</span>
                    <a href="{{ route('locale.switch', 'ar') }}" class="{{ app()->getLocale() === 'ar' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600' }}">ع</a>
                </div>

                {{-- Cart --}}
                <a href="{{ route('cart.index') }}" class="relative p-2 rounded-full hover:bg-gray-100 transition">
                    <svg class="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                    @if($cartCount > 0)
                        <span class="absolute -top-0.5 -end-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center">{{ $cartCount }}</span>
                    @endif
                </a>

                {{-- Account --}}
                @auth
                    <a href="{{ route('dashboard') }}" class="hidden sm:inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-indigo-600">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                    </a>
                @else
                    <a href="{{ route('login') }}" class="hidden sm:inline-flex items-center rounded-full bg-gray-900 text-white text-sm font-semibold px-4 py-2 hover:bg-gray-700 transition">{{ __('shop.login') }}</a>
                @endauth

                {{-- Mobile toggle --}}
                <button @click="mobile = !mobile" class="md:hidden p-2 rounded-full hover:bg-gray-100">
                    <svg class="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
                </button>
            </div>
        </div>

        {{-- Mobile menu --}}
        <div x-show="mobile" x-transition x-cloak class="md:hidden pb-4 space-y-3">
            <form action="{{ route('products.index') }}" method="GET">
                <input type="text" name="search" value="{{ request('search') }}" placeholder="{{ __('shop.search_placeholder') }}"
                       class="w-full rounded-full border-gray-200 bg-gray-50 px-4 py-2 text-sm">
            </form>
            <nav class="flex flex-col gap-1 text-sm font-medium text-gray-700">
                <a href="{{ route('home') }}" class="px-3 py-2 rounded-lg hover:bg-gray-100">{{ __('shop.home') }}</a>
                <a href="{{ route('products.index') }}" class="px-3 py-2 rounded-lg hover:bg-gray-100">{{ __('shop.products') }}</a>
                <a href="{{ route('orders.track.form') }}" class="px-3 py-2 rounded-lg hover:bg-gray-100">{{ __('shop.track_order') }}</a>
                @auth
                    <a href="{{ route('dashboard') }}" class="px-3 py-2 rounded-lg hover:bg-gray-100">{{ __('shop.account') }}</a>
                @else
                    <a href="{{ route('login') }}" class="px-3 py-2 rounded-lg hover:bg-gray-100">{{ __('shop.login') }}</a>
                @endauth
            </nav>
            <div class="flex items-center gap-3 px-3 text-xs font-semibold">
                <a href="{{ route('locale.switch', 'en') }}" class="{{ app()->getLocale() === 'en' ? 'text-indigo-600' : 'text-gray-400' }}">English</a>
                <a href="{{ route('locale.switch', 'ar') }}" class="{{ app()->getLocale() === 'ar' ? 'text-indigo-600' : 'text-gray-400' }}">العربية</a>
            </div>
        </div>
    </div>
</header>
