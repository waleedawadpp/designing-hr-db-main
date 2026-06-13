@extends('layouts.admin')

@section('title', __('admin.orders'))

@section('content')
<div class="space-y-6">
    <h1 class="text-2xl font-extrabold text-gray-900">{{ __('admin.orders') }}</h1>

    {{-- Filters --}}
    <form action="{{ route('admin.orders.index') }}" method="GET" class="flex flex-col sm:flex-row gap-3">
        <input type="text" name="search" value="{{ request('search') }}" placeholder="{{ __('admin.search') }}" class="rounded-full border-gray-200 text-sm sm:max-w-xs flex-1">
        <select name="status" class="rounded-full border-gray-200 text-sm">
            <option value="">{{ __('admin.all_statuses') }}</option>
            @foreach(($statuses ?? []) as $status)
                <option value="{{ $status }}" @selected(request('status') === $status)>{{ __('admin.status_'.$status) }}</option>
            @endforeach
        </select>
        <button type="submit" class="rounded-full bg-gray-900 text-white text-sm font-semibold px-6 py-2 hover:bg-indigo-600 transition">{{ __('admin.search') }}</button>
    </form>

    <div class="bg-white rounded-2xl border border-gray-100 card-shadow overflow-x-auto">
        <table class="w-full text-sm">
            <thead class="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                    <th class="px-4 py-3 text-start">{{ __('shop.order_number') }}</th>
                    <th class="px-4 py-3 text-start">{{ __('admin.customer') }}</th>
                    <th class="px-4 py-3 text-start">{{ __('admin.total') }}</th>
                    <th class="px-4 py-3 text-start">{{ __('admin.status') }}</th>
                    <th class="px-4 py-3 text-start">{{ __('admin.date') }}</th>
                    <th class="px-4 py-3 text-end">{{ __('admin.actions') }}</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
                @forelse($orders as $order)
                    @php
                        $badge = match($order->status_color) {
                            'yellow' => 'bg-amber-100 text-amber-700',
                            'blue' => 'bg-blue-100 text-blue-700',
                            'indigo' => 'bg-indigo-100 text-indigo-700',
                            'purple' => 'bg-purple-100 text-purple-700',
                            'green' => 'bg-emerald-100 text-emerald-700',
                            'red' => 'bg-rose-100 text-rose-700',
                            default => 'bg-gray-100 text-gray-700',
                        };
                    @endphp
                    <tr class="hover:bg-gray-50">
                        <td class="px-4 py-3 font-mono font-medium text-gray-800">{{ $order->order_number }}</td>
                        <td class="px-4 py-3 text-gray-700">{{ $order->customer_name }}</td>
                        <td class="px-4 py-3 font-semibold text-gray-800">{{ money($order->total) }}</td>
                        <td class="px-4 py-3">
                            <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold {{ $badge }}">{{ __('admin.status_'.$order->status) }}</span>
                        </td>
                        <td class="px-4 py-3 text-gray-500">{{ $order->created_at->format('Y-m-d') }}</td>
                        <td class="px-4 py-3 text-end">
                            <a href="{{ route('admin.orders.show', $order) }}" class="text-sm font-medium text-indigo-600 hover:underline">{{ __('admin.view') }}</a>
                        </td>
                    </tr>
                @empty
                    <tr><td colspan="6" class="px-4 py-10 text-center text-gray-400">{{ __('admin.no_records') }}</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>

    <div>{{ $orders->withQueryString()->links() }}</div>
</div>
@endsection
