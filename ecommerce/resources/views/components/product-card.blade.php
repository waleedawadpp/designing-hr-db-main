@props(['product'])

<div class="group relative bg-white rounded-2xl overflow-hidden border border-gray-100 card-shadow hover:-translate-y-1 transition duration-300 flex flex-col">
    {{-- Image --}}
    <a href="{{ route('products.show', $product->slug) }}" class="block relative aspect-square bg-gray-50 overflow-hidden">
        @if($product->main_image)
            <img src="{{ asset('storage/'.$product->main_image) }}" alt="{{ $product->name }}"
                 class="h-full w-full object-cover group-hover:scale-105 transition duration-500" loading="lazy">
        @else
            <div class="h-full w-full flex items-center justify-center text-gray-300">
                <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.6-4.6a2 2 0 012.8 0L16 16m-2-2l1.6-1.6a2 2 0 012.8 0L20 14M4 6h16v12H4z"/></svg>
            </div>
        @endif

        {{-- Badges --}}
        <div class="absolute top-3 start-3 flex flex-col gap-2">
            @if($product->on_sale)
                <span class="bg-rose-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">{{ __('shop.on_sale') }}</span>
            @endif
            @unless($product->in_stock)
                <span class="bg-gray-800 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">{{ __('shop.out_of_stock') }}</span>
            @endunless
        </div>

        {{-- Quick view --}}
        <span class="absolute bottom-3 end-3 opacity-0 group-hover:opacity-100 transition bg-white/90 backdrop-blur text-gray-800 text-xs font-semibold px-3 py-1.5 rounded-full shadow">
            {{ __('shop.quick_view') }}
        </span>
    </a>

    {{-- Body --}}
    <div class="p-4 flex flex-col flex-1">
        @if($product->category)
            <span class="text-[11px] uppercase tracking-wide text-gray-400 mb-1">{{ $product->category->name }}</span>
        @endif
        <a href="{{ route('products.show', $product->slug) }}" class="font-semibold text-gray-900 line-clamp-2 hover:text-indigo-600 transition">{{ $product->name }}</a>

        <div class="mt-3 flex items-center justify-between gap-2 mt-auto pt-3">
            <x-price :product="$product" />
        </div>

        @if($product->in_stock)
            <form action="{{ route('cart.add') }}" method="POST" class="mt-3">
                @csrf
                <input type="hidden" name="product_id" value="{{ $product->id }}">
                <input type="hidden" name="quantity" value="1">
                <button type="submit" class="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gray-900 text-white text-sm font-semibold py-2.5 hover:bg-indigo-600 transition">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M17 17a2 2 0 100 4 2 2 0 000-4zM9 17a2 2 0 100 4 2 2 0 000-4z"/></svg>
                    {{ __('shop.add_to_cart') }}
                </button>
            </form>
        @else
            <button disabled class="mt-3 w-full rounded-full bg-gray-100 text-gray-400 text-sm font-semibold py-2.5 cursor-not-allowed">{{ __('shop.out_of_stock') }}</button>
        @endif
    </div>
</div>
