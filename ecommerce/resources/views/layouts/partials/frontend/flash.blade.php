@if(session('success') || session('error'))
    <div class="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-4 space-y-3">
        @if(session('success'))
            <div x-data="{ show: true }" x-show="show" x-transition.opacity x-init="setTimeout(() => show = false, 6000)"
                 class="flex items-center justify-between gap-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 px-5 py-4 card-shadow">
                <div class="flex items-center gap-3">
                    <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                    <span class="text-sm font-medium">{{ session('success') }}</span>
                </div>
                <button @click="show = false" class="text-emerald-500 hover:text-emerald-700 text-xl leading-none">&times;</button>
            </div>
        @endif
        @if(session('error'))
            <div x-data="{ show: true }" x-show="show" x-transition.opacity
                 class="flex items-center justify-between gap-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 px-5 py-4 card-shadow">
                <div class="flex items-center gap-3">
                    <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <span class="text-sm font-medium">{{ session('error') }}</span>
                </div>
                <button @click="show = false" class="text-rose-500 hover:text-rose-700 text-xl leading-none">&times;</button>
            </div>
        @endif
    </div>
@endif
