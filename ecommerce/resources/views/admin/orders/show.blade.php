@extends('layouts.admin')

@section('title', __('admin.order_details').' - '.$order->order_number)

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

@section('content')
<div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
            <h1 class="text-2xl font-extrabold text-gray-900">{{ __('admin.order_details') }}</h1>
            <p class="text-sm text-gray-500 mt-1">{{ $order->order_number }} · {{ $order->created_at->format('Y-m-d H:i') }}</p>
        </div>
        <span class="inline-flex self-start items-center rounded-full px-4 py-1.5 text-sm font-semibold {{ $badge }}">{{ __('admin.status_'.$order->status) }}</span>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {{-- Items + totals --}}
        <div class="lg:col-span-2 space-y-6">
            <div class="bg-white rounded-2xl border border-gray-100 card-shadow overflow-hidden">
                <h2 class="font-bold text-gray-900 p-5 border-b border-gray-100">{{ __('admin.order_items') }}</h2>
                <table class="w-full text-sm">
                    <thead class="bg-gray-50 text-gray-500 text-xs uppercase">
                        <tr>
                            <th class="px-5 py-3 text-start">{{ __('admin.product') }}</th>
                            <th class="px-5 py-3 text-start">{{ __('admin.unit_price') }}</th>
                            <th class="px-5 py-3 text-start">{{ __('admin.quantity') }}</th>
                            <th class="px-5 py-3 text-end">{{ __('admin.total') }}</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        @foreach($order->items as $item)
                            <tr>
                                <td class="px-5 py-3 font-medium text-gray-800">{{ $item->product_name }}</td>
                                <td class="px-5 py-3 text-gray-600">{{ money($item->unit_price) }}</td>
                                <td class="px-5 py-3 text-gray-600">{{ $item->quantity }}</td>
                                <td class="px-5 py-3 text-end font-semibold">{{ money($item->total) }}</td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
                <dl class="p-5 space-y-2 text-sm border-t border-gray-100">
                    <div class="flex justify-between"><dt class="text-gray-500">{{ __('admin.subtotal') }}</dt><dd>{{ money($order->subtotal) }}</dd></div>
                    @if($order->discount > 0)
                        <div class="flex justify-between text-emerald-600"><dt>{{ __('admin.discount') }}</dt><dd>- {{ money($order->discount) }}</dd></div>
                    @endif
                    <div class="flex justify-between"><dt class="text-gray-500">{{ __('admin.tax') }}</dt><dd>{{ money($order->tax) }}</dd></div>
                    <div class="flex justify-between"><dt class="text-gray-500">{{ __('admin.shipping') }}</dt><dd>{{ money($order->shipping) }}</dd></div>
                    <div class="flex justify-between border-t border-gray-100 pt-2 mt-2"><dt class="font-bold text-gray-900">{{ __('admin.total') }}</dt><dd class="font-extrabold text-indigo-600">{{ money($order->total) }}</dd></div>
                </dl>
            </div>
        </div>

        {{-- Sidebar --}}
        <div class="space-y-6">
            {{-- Customer --}}
            <div class="bg-white rounded-2xl border border-gray-100 card-shadow p-6 space-y-2 text-sm">
                <h2 class="font-bold text-gray-900 mb-2">{{ __('admin.customer_info') }}</h2>
                <p><span class="text-gray-500">{{ __('admin.customer') }}:</span> {{ $order->customer_name }}</p>
                <p><span class="text-gray-500">{{ __('admin.phone') }}:</span> {{ $order->phone }}</p>
                <p><span class="text-gray-500">{{ __('admin.email') }}:</span> {{ $order->email }}</p>
                <p><span class="text-gray-500">{{ __('admin.address') }}:</span> {{ $order->address }}</p>
                <p><span class="text-gray-500">{{ __('admin.city') }}:</span> {{ $order->city }}, {{ $order->country }}</p>
                @if($order->notes)
                    <p><span class="text-gray-500">{{ __('admin.notes') }}:</span> {{ $order->notes }}</p>
                @endif
            </div>

            {{-- Status update --}}
            <div class="bg-white rounded-2xl border border-gray-100 card-shadow p-6 space-y-4">
                <h2 class="font-bold text-gray-900">{{ __('admin.update_status') }}</h2>
                <form action="{{ route('admin.orders.status', $order) }}" method="POST" class="flex gap-2">
                    @csrf @method('PATCH')
                    <select name="status" class="flex-1 rounded-xl border-gray-200 text-sm">
                        @foreach(($statuses ?? []) as $status)
                            <option value="{{ $status }}" @selected($order->status === $status)>{{ __('admin.status_'.$status) }}</option>
                        @endforeach
                    </select>
                    <button type="submit" class="rounded-xl bg-gray-900 text-white text-sm font-semibold px-4 hover:bg-indigo-600 transition">{{ __('admin.save') }}</button>
                </form>
            </div>

            {{-- Invoice --}}
            <div class="bg-white rounded-2xl border border-gray-100 card-shadow p-6 space-y-3">
                <h2 class="font-bold text-gray-900">{{ __('admin.invoice') }}</h2>
                <a href="{{ route('admin.orders.invoice', $order) }}" class="block w-full text-center rounded-full bg-gray-900 text-white text-sm font-semibold py-2.5 hover:bg-indigo-600 transition">{{ __('admin.download_invoice') }}</a>
                <form action="{{ route('admin.orders.invoice.regenerate', $order) }}" method="POST">
                    @csrf
                    <button type="submit" class="w-full rounded-full border border-gray-200 text-gray-600 text-sm font-semibold py-2.5 hover:bg-gray-50 transition">{{ __('admin.regenerate_invoice') }}</button>
                </form>
            </div>
        </div>
    </div>
</div>
@endsection
