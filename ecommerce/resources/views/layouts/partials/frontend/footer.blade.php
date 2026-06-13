<footer class="bg-gray-900 text-gray-300 mt-20">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            {{-- About --}}
            <div class="space-y-4">
                <h3 class="text-lg font-extrabold text-white">{{ setting('store_name', config('app.name')) }}</h3>
                <p class="text-sm leading-relaxed text-gray-400">{{ __('shop.about_text') }}</p>
            </div>

            {{-- Quick links --}}
            <div class="space-y-4">
                <h4 class="text-sm font-semibold uppercase tracking-wider text-white">{{ __('shop.quick_links') }}</h4>
                <ul class="space-y-2 text-sm">
                    <li><a href="{{ route('home') }}" class="text-gray-400 hover:text-white transition">{{ __('shop.home') }}</a></li>
                    <li><a href="{{ route('products.index') }}" class="text-gray-400 hover:text-white transition">{{ __('shop.products') }}</a></li>
                    <li><a href="{{ route('cart.index') }}" class="text-gray-400 hover:text-white transition">{{ __('shop.cart') }}</a></li>
                    <li><a href="{{ route('orders.track.form') }}" class="text-gray-400 hover:text-white transition">{{ __('shop.track_order') }}</a></li>
                </ul>
            </div>

            {{-- Social --}}
            <div class="space-y-4">
                <h4 class="text-sm font-semibold uppercase tracking-wider text-white">{{ __('shop.follow_us') }}</h4>
                <div class="flex items-center gap-3">
                    @if(setting('facebook'))
                        <a href="{{ setting('facebook') }}" target="_blank" rel="noopener" class="h-10 w-10 rounded-full bg-white/10 hover:bg-indigo-600 flex items-center justify-center transition">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M22 12a10 10 0 10-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0022 12z"/></svg>
                        </a>
                    @endif
                    @if(setting('instagram'))
                        <a href="{{ setting('instagram') }}" target="_blank" rel="noopener" class="h-10 w-10 rounded-full bg-white/10 hover:bg-indigo-600 flex items-center justify-center transition">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.72 3.72 0 01-1.38-.9 3.72 3.72 0 01-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zm0 3.68A6.16 6.16 0 1018.16 12 6.16 6.16 0 0012 5.84zm0 10.16A4 4 0 1116 12a4 4 0 01-4 4zm6.4-10.4a1.44 1.44 0 11-1.44-1.44 1.44 1.44 0 011.44 1.44z"/></svg>
                        </a>
                    @endif
                    @if(setting('twitter'))
                        <a href="{{ setting('twitter') }}" target="_blank" rel="noopener" class="h-10 w-10 rounded-full bg-white/10 hover:bg-indigo-600 flex items-center justify-center transition">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.9 2H22l-7.5 8.6L23.3 22h-6.8l-5.3-6.9L5.1 22H2l8-9.2L1 2h7l4.8 6.3L18.9 2zm-2.4 18h1.9L7.6 4H5.6l10.9 16z"/></svg>
                        </a>
                    @endif
                </div>
                @if(setting('whatsapp_number'))
                    <p class="text-sm text-gray-400">{{ __('admin.whatsapp_number') }}: {{ setting('whatsapp_number') }}</p>
                @endif
            </div>

            {{-- Newsletter --}}
            <div class="space-y-4">
                <h4 class="text-sm font-semibold uppercase tracking-wider text-white">{{ __('shop.newsletter') }}</h4>
                <p class="text-sm text-gray-400">{{ __('shop.newsletter_desc') }}</p>
                <form onsubmit="return false" class="flex gap-2">
                    <input type="email" placeholder="{{ __('shop.your_email') }}" class="flex-1 min-w-0 rounded-full bg-white/10 border-transparent text-white placeholder-gray-500 text-sm px-4 py-2 focus:ring-indigo-400 focus:border-indigo-400">
                    <button type="submit" class="rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 transition">{{ __('shop.subscribe') }}</button>
                </form>
            </div>
        </div>

        <div class="border-t border-white/10 mt-10 pt-6 text-center text-sm text-gray-500">
            &copy; {{ date('Y') }} {{ setting('store_name', config('app.name')) }}. {{ __('shop.all_rights_reserved') }}
        </div>
    </div>
</footer>
