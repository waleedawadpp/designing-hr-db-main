@extends('layouts.app')

@section('title', __('shop.checkout'))

@section('content')
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
    <h1 class="text-2xl font-extrabold text-gray-900 mb-8">{{ __('shop.checkout_details') }}</h1>

    <form action="{{ route('checkout.store') }}" method="POST" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        @csrf
        {{-- Form --}}
        <div class="lg:col-span-2 bg-white rounded-2xl border border-gray-100 card-shadow p-7 space-y-5">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('shop.full_name') }}</label>
                    <input type="text" name="customer_name" value="{{ old('customer_name') }}" class="w-full rounded-xl border-gray-200 focus:ring-indigo-400 focus:border-indigo-400 @error('customer_name') border-rose-400 @enderror">
                    @error('customer_name')<p class="text-xs text-rose-500 mt-1">{{ $message }}</p>@enderror
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('shop.phone') }}</label>
                    <input type="text" name="phone" value="{{ old('phone') }}" class="w-full rounded-xl border-gray-200 focus:ring-indigo-400 focus:border-indigo-400 @error('phone') border-rose-400 @enderror">
                    @error('phone')<p class="text-xs text-rose-500 mt-1">{{ $message }}</p>@enderror
                </div>
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('shop.email') }}</label>
                <input type="email" name="email" value="{{ old('email') }}" class="w-full rounded-xl border-gray-200 focus:ring-indigo-400 focus:border-indigo-400 @error('email') border-rose-400 @enderror">
                @error('email')<p class="text-xs text-rose-500 mt-1">{{ $message }}</p>@enderror
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('shop.address') }}</label>
                <textarea name="address" rows="2" class="w-full rounded-xl border-gray-200 focus:ring-indigo-400 focus:border-indigo-400 @error('address') border-rose-400 @enderror">{{ old('address') }}</textarea>
                @error('address')<p class="text-xs text-rose-500 mt-1">{{ $message }}</p>@enderror
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('shop.city') }}</label>
                    <input type="text" name="city" value="{{ old('city') }}" class="w-full rounded-xl border-gray-200 focus:ring-indigo-400 focus:border-indigo-400 @error('city') border-rose-400 @enderror">
                    @error('city')<p class="text-xs text-rose-500 mt-1">{{ $message }}</p>@enderror
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('shop.country') }}</label>
                    <input type="text" name="country" value="{{ old('country') }}" class="w-full rounded-xl border-gray-200 focus:ring-indigo-400 focus:border-indigo-400 @error('country') border-rose-400 @enderror">
                    @error('country')<p class="text-xs text-rose-500 mt-1">{{ $message }}</p>@enderror
                </div>
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('shop.notes') }}</label>
                <textarea name="notes" rows="3" class="w-full rounded-xl border-gray-200 focus:ring-indigo-400 focus:border-indigo-400">{{ old('notes') }}</textarea>
            </div>
        </div>

        {{-- Summary --}}
        <div>
            <div class="bg-white rounded-2xl border border-gray-100 card-shadow p-6 sticky top-20 space-y-4">
                <h2 class="text-lg font-bold text-gray-900">{{ __('shop.order_summary') }}</h2>
                <div class="space-y-3 max-h-64 overflow-y-auto">
                    @foreach(($lines ?? []) as $line)
                        @php $product = $line['product']; @endphp
                        <div class="flex items-center gap-3 text-sm">
                            <div class="h-12 w-12 rounded-lg bg-gray-50 overflow-hidden flex-shrink-0">
                                @if($product->main_image)<img src="{{ asset('storage/'.$product->main_image) }}" class="h-full w-full object-cover" alt="">@endif
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="font-medium text-gray-800 line-clamp-1">{{ $product->name }}</p>
                                <p class="text-gray-400">{{ __('shop.qty') }}: {{ $line['qty'] }}</p>
                            </div>
                            <span class="font-medium whitespace-nowrap">{{ money($line['line_total']) }}</span>
                        </div>
                    @endforeach
                </div>
                <dl class="space-y-2 text-sm border-t border-gray-100 pt-4">
                    <div class="flex justify-between"><dt class="text-gray-500">{{ __('shop.subtotal') }}</dt><dd class="font-medium">{{ money($summary['subtotal'] ?? 0) }}</dd></div>
                    @if(($summary['discount'] ?? 0) > 0)
                        <div class="flex justify-between text-emerald-600"><dt>{{ __('shop.discount') }}</dt><dd>- {{ money($summary['discount']) }}</dd></div>
                    @endif
                    <div class="flex justify-between"><dt class="text-gray-500">{{ __('shop.tax') }}</dt><dd class="font-medium">{{ money($summary['tax'] ?? 0) }}</dd></div>
                    <div class="flex justify-between"><dt class="text-gray-500">{{ __('shop.shipping') }}</dt><dd class="font-medium">{{ ($summary['shipping'] ?? 0) > 0 ? money($summary['shipping']) : __('shop.free') }}</dd></div>
                </dl>
                <div class="border-t border-gray-100 pt-4 flex justify-between items-baseline">
                    <span class="font-bold text-gray-900">{{ __('shop.total') }}</span>
                    <span class="text-xl font-extrabold text-indigo-600">{{ money($summary['total'] ?? 0) }}</span>
                </div>
                <button type="submit" class="block w-full text-center rounded-full bg-gray-900 text-white font-semibold py-3 hover:bg-indigo-600 transition">{{ __('shop.place_order') }}</button>
            </div>
        </div>
    </form>
</div>
@endsection
