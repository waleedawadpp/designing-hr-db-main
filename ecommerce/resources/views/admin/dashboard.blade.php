@extends('layouts.admin')

@section('title', __('admin.dashboard'))

@section('content')
<div class="space-y-8">
    <h1 class="text-2xl font-extrabold text-gray-900">{{ __('admin.dashboard') }}</h1>

    {{-- Stat cards --}}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        @php
            $cards = [
                ['label' => 'total_products', 'value' => $stats['products'] ?? 0, 'color' => 'indigo'],
                ['label' => 'total_orders', 'value' => $stats['orders'] ?? 0, 'color' => 'blue'],
                ['label' => 'total_revenue', 'value' => money($stats['revenue'] ?? 0), 'color' => 'emerald'],
                ['label' => 'total_customers', 'value' => $stats['customers'] ?? 0, 'color' => 'purple'],
                ['label' => 'pending_orders', 'value' => $stats['pending'] ?? 0, 'color' => 'amber'],
            ];
        @endphp
        @foreach($cards as $c)
            @php
                $ring = match($c['color']) {
                    'indigo' => 'bg-indigo-50 text-indigo-600',
                    'blue' => 'bg-blue-50 text-blue-600',
                    'emerald' => 'bg-emerald-50 text-emerald-600',
                    'purple' => 'bg-purple-50 text-purple-600',
                    default => 'bg-amber-50 text-amber-600',
                };
            @endphp
            <div class="bg-white rounded-2xl border border-gray-100 card-shadow p-5">
                <div class="h-10 w-10 rounded-xl {{ $ring }} flex items-center justify-center mb-3">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 7h18M3 12h18M3 17h18"/></svg>
                </div>
                <p class="text-sm text-gray-500">{{ __('admin.'.$c['label']) }}</p>
                <p class="text-2xl font-extrabold text-gray-900 mt-1">{{ $c['value'] }}</p>
            </div>
        @endforeach
    </div>

    {{-- Charts --}}
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 bg-white rounded-2xl border border-gray-100 card-shadow p-6">
            <h2 class="font-bold text-gray-900 mb-4">{{ __('admin.monthly_revenue') }}</h2>
            <canvas id="revenueChart" height="120"></canvas>
        </div>
        <div class="bg-white rounded-2xl border border-gray-100 card-shadow p-6">
            <h2 class="font-bold text-gray-900 mb-4">{{ __('admin.orders_by_status') }}</h2>
            <canvas id="statusChart"></canvas>
        </div>
    </div>

    {{-- Tables --}}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white rounded-2xl border border-gray-100 card-shadow overflow-hidden">
            <h2 class="font-bold text-gray-900 p-5 border-b border-gray-100">{{ __('admin.top_products') }}</h2>
            <table class="w-full text-sm">
                <tbody class="divide-y divide-gray-100">
                    @forelse(($topProducts ?? []) as $p)
                        <tr>
                            <td class="px-5 py-3 font-medium text-gray-800">{{ $p->name }}</td>
                            <td class="px-5 py-3 text-end text-gray-500">{{ $p->sold }} {{ __('admin.sold') }}</td>
                        </tr>
                    @empty
                        <tr><td class="px-5 py-6 text-center text-gray-400">{{ __('admin.no_records') }}</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>

        <div class="bg-white rounded-2xl border border-gray-100 card-shadow overflow-hidden">
            <h2 class="font-bold text-gray-900 p-5 border-b border-gray-100">{{ __('admin.recent_orders') }}</h2>
            <table class="w-full text-sm">
                <tbody class="divide-y divide-gray-100">
                    @forelse(($recentOrders ?? []) as $o)
                        <tr>
                            <td class="px-5 py-3">
                                <a href="{{ route('admin.orders.show', $o) }}" class="font-medium text-indigo-600 hover:underline">{{ $o->order_number }}</a>
                                <p class="text-gray-400 text-xs">{{ $o->customer_name }}</p>
                            </td>
                            <td class="px-5 py-3 text-end font-semibold text-gray-800">{{ money($o->total) }}</td>
                        </tr>
                    @empty
                        <tr><td class="px-5 py-6 text-center text-gray-400">{{ __('admin.no_records') }}</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>
</div>
@endsection

@push('scripts')
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<script>
    document.addEventListener('DOMContentLoaded', function () {
        const months = @json($months ?? []);
        const statuses = @json($ordersByStatus ?? []);

        const rc = document.getElementById('revenueChart');
        if (rc) {
            new Chart(rc, {
                type: 'line',
                data: {
                    labels: Object.keys(months),
                    datasets: [{
                        label: '{{ __('admin.monthly_revenue') }}',
                        data: Object.values(months),
                        borderColor: '#4f46e5',
                        backgroundColor: 'rgba(79,70,229,0.1)',
                        fill: true,
                        tension: 0.35,
                    }]
                },
                options: { responsive: true, plugins: { legend: { display: false } } }
            });
        }

        const sc = document.getElementById('statusChart');
        if (sc) {
            new Chart(sc, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(statuses),
                    datasets: [{
                        data: Object.values(statuses),
                        backgroundColor: ['#f59e0b','#3b82f6','#6366f1','#a855f7','#10b981','#ef4444','#9ca3af'],
                    }]
                },
                options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
            });
        }
    });
</script>
@endpush
