@extends('layouts.admin')

@section('title', __('admin.products'))

@section('content')
@php $trashed = request('trashed'); @endphp
<div class="space-y-6" x-data="{ all: false }">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 class="text-2xl font-extrabold text-gray-900">{{ __('admin.products') }}</h1>
        <div class="flex items-center gap-3">
            <a href="{{ route('admin.products.index', $trashed ? [] : ['trashed' => 1]) }}"
               class="inline-flex items-center rounded-full border border-gray-200 bg-white text-gray-600 text-sm font-semibold px-4 py-2 hover:bg-gray-50">
                {{ $trashed ? __('admin.back_to_list') : __('admin.view_trashed') }}
            </a>
            <a href="{{ route('admin.products.create') }}" class="inline-flex items-center gap-1.5 rounded-full bg-gray-900 text-white text-sm font-semibold px-4 py-2 hover:bg-indigo-600 transition">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                {{ __('admin.create') }}
            </a>
        </div>
    </div>

    {{-- Search --}}
    <form action="{{ route('admin.products.index') }}" method="GET" class="flex gap-2 max-w-md">
        @if($trashed)<input type="hidden" name="trashed" value="1">@endif
        <input type="text" name="search" value="{{ request('search') }}" placeholder="{{ __('admin.search') }}" class="flex-1 rounded-full border-gray-200 text-sm">
        <button type="submit" class="rounded-full bg-gray-900 text-white text-sm font-semibold px-5 hover:bg-indigo-600 transition">{{ __('admin.search') }}</button>
    </form>

    <form action="{{ route('admin.products.bulk') }}" method="POST" class="bg-white rounded-2xl border border-gray-100 card-shadow overflow-hidden">
        @csrf
        @unless($trashed)
            <div class="flex items-center gap-2 p-4 border-b border-gray-100 bg-gray-50">
                <select name="action" class="rounded-lg border-gray-200 text-sm">
                    <option value="">{{ __('admin.select_action') }}</option>
                    <option value="activate">{{ __('admin.activate') }}</option>
                    <option value="deactivate">{{ __('admin.deactivate') }}</option>
                    <option value="feature">{{ __('admin.feature') }}</option>
                    <option value="unfeature">{{ __('admin.unfeature') }}</option>
                    <option value="delete">{{ __('admin.delete') }}</option>
                </select>
                <button type="submit" class="rounded-lg bg-gray-900 text-white text-sm font-semibold px-4 py-2 hover:bg-indigo-600 transition">{{ __('admin.apply') }}</button>
            </div>
        @endunless

        <div class="overflow-x-auto">
            <table class="w-full text-sm">
                <thead class="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                        @unless($trashed)<th class="px-4 py-3"><input type="checkbox" @click="all = !all" class="rounded border-gray-300"></th>@endunless
                        <th class="px-4 py-3 text-start">{{ __('admin.image') }}</th>
                        <th class="px-4 py-3 text-start">{{ __('admin.name_en') }}</th>
                        <th class="px-4 py-3 text-start">{{ __('admin.sku') }}</th>
                        <th class="px-4 py-3 text-start">{{ __('admin.price') }}</th>
                        <th class="px-4 py-3 text-start">{{ __('admin.stock') }}</th>
                        <th class="px-4 py-3 text-start">{{ __('admin.status') }}</th>
                        <th class="px-4 py-3 text-start">{{ __('admin.featured') }}</th>
                        <th class="px-4 py-3 text-end">{{ __('admin.actions') }}</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                    @forelse($products as $product)
                        <tr class="hover:bg-gray-50">
                            @unless($trashed)
                                <td class="px-4 py-3"><input type="checkbox" name="ids[]" value="{{ $product->id }}" :checked="all" class="rounded border-gray-300"></td>
                            @endunless
                            <td class="px-4 py-3">
                                <div class="h-12 w-12 rounded-lg bg-gray-50 overflow-hidden">
                                    @if($product->main_image)<img src="{{ asset('storage/'.$product->main_image) }}" class="h-full w-full object-cover" alt="">@endif
                                </div>
                            </td>
                            <td class="px-4 py-3 font-medium text-gray-800">{{ $product->name }}</td>
                            <td class="px-4 py-3 text-gray-500">{{ $product->sku }}</td>
                            <td class="px-4 py-3 text-gray-700">{{ money($product->effective_price) }}</td>
                            <td class="px-4 py-3 text-gray-700">{{ $product->stock }}</td>
                            <td class="px-4 py-3">
                                <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold {{ $product->status ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600' }}">
                                    {{ $product->status ? __('admin.active') : __('admin.inactive') }}
                                </span>
                            </td>
                            <td class="px-4 py-3">
                                @if($product->featured)
                                    <span class="text-amber-500">&#9733;</span>
                                @else
                                    <span class="text-gray-300">&#9734;</span>
                                @endif
                            </td>
                            <td class="px-4 py-3">
                                <div class="flex items-center justify-end gap-2">
                                    @if($trashed)
                                        <form action="{{ route('admin.products.restore', $product->id) }}" method="POST">
                                            @csrf @method('PUT')
                                            <button type="submit" class="text-sm font-medium text-emerald-600 hover:underline">{{ __('admin.restore') }}</button>
                                        </form>
                                    @else
                                        <a href="{{ route('admin.products.edit', $product->id) }}" class="text-sm font-medium text-indigo-600 hover:underline">{{ __('admin.edit') }}</a>
                                        <form action="{{ route('admin.products.destroy', $product->id) }}" method="POST" onsubmit="return confirm('{{ __('admin.confirm_delete') }}')">
                                            @csrf @method('DELETE')
                                            <button type="submit" class="text-sm font-medium text-rose-600 hover:underline">{{ __('admin.delete') }}</button>
                                        </form>
                                    @endif
                                </div>
                            </td>
                        </tr>
                    @empty
                        <tr><td colspan="9" class="px-4 py-10 text-center text-gray-400">{{ __('admin.no_records') }}</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </form>

    <div>{{ $products->withQueryString()->links() }}</div>
</div>
@endsection
