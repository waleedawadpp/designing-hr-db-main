@extends('layouts.admin')

@section('title', __('admin.coupons'))

@section('content')
<div class="space-y-6">
    <div class="flex items-center justify-between">
        <h1 class="text-2xl font-extrabold text-gray-900">{{ __('admin.coupons') }}</h1>
        <a href="{{ route('admin.coupons.create') }}" class="inline-flex items-center gap-1.5 rounded-full bg-gray-900 text-white text-sm font-semibold px-4 py-2 hover:bg-indigo-600 transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            {{ __('admin.create') }}
        </a>
    </div>

    <div class="bg-white rounded-2xl border border-gray-100 card-shadow overflow-x-auto">
        <table class="w-full text-sm">
            <thead class="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                    <th class="px-4 py-3 text-start">{{ __('admin.code') }}</th>
                    <th class="px-4 py-3 text-start">{{ __('admin.type') }}</th>
                    <th class="px-4 py-3 text-start">{{ __('admin.value') }}</th>
                    <th class="px-4 py-3 text-start">{{ __('admin.usage_limit') }}</th>
                    <th class="px-4 py-3 text-start">{{ __('admin.end_date') }}</th>
                    <th class="px-4 py-3 text-start">{{ __('admin.status') }}</th>
                    <th class="px-4 py-3 text-end">{{ __('admin.actions') }}</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
                @forelse($coupons as $coupon)
                    <tr class="hover:bg-gray-50">
                        <td class="px-4 py-3 font-mono font-semibold text-gray-800">{{ $coupon->code }}</td>
                        <td class="px-4 py-3 text-gray-500">{{ $coupon->type === 'percentage' ? __('admin.percentage') : __('admin.fixed') }}</td>
                        <td class="px-4 py-3 text-gray-700">{{ $coupon->type === 'percentage' ? $coupon->value.'%' : money($coupon->value) }}</td>
                        <td class="px-4 py-3 text-gray-500">{{ $coupon->usage_limit ?? '∞' }}</td>
                        <td class="px-4 py-3 text-gray-500">{{ $coupon->end_date ? \Illuminate\Support\Carbon::parse($coupon->end_date)->format('Y-m-d') : '—' }}</td>
                        <td class="px-4 py-3">
                            <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold {{ $coupon->status ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600' }}">
                                {{ $coupon->status ? __('admin.active') : __('admin.inactive') }}
                            </span>
                        </td>
                        <td class="px-4 py-3">
                            <div class="flex items-center justify-end gap-2">
                                <a href="{{ route('admin.coupons.edit', $coupon->id) }}" class="text-sm font-medium text-indigo-600 hover:underline">{{ __('admin.edit') }}</a>
                                <form action="{{ route('admin.coupons.destroy', $coupon->id) }}" method="POST" onsubmit="return confirm('{{ __('admin.confirm_delete') }}')">
                                    @csrf @method('DELETE')
                                    <button type="submit" class="text-sm font-medium text-rose-600 hover:underline">{{ __('admin.delete') }}</button>
                                </form>
                            </div>
                        </td>
                    </tr>
                @empty
                    <tr><td colspan="7" class="px-4 py-10 text-center text-gray-400">{{ __('admin.no_records') }}</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>

    @if(method_exists($coupons, 'links'))
        <div>{{ $coupons->withQueryString()->links() }}</div>
    @endif
</div>
@endsection
