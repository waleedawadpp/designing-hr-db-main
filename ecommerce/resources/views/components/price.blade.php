@props(['product'])

<div {{ $attributes->merge(['class' => 'flex items-baseline gap-2 flex-wrap']) }}>
    @if($product->on_sale)
        <span class="text-lg font-bold text-indigo-600">{{ money($product->effective_price) }}</span>
        <span class="text-sm text-gray-400 line-through">{{ money($product->price) }}</span>
    @else
        <span class="text-lg font-bold text-gray-900">{{ money($product->effective_price) }}</span>
    @endif
</div>
