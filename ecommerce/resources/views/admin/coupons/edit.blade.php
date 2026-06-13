@extends('layouts.admin')

@section('title', __('admin.edit').' - '.$coupon->code)

@section('content')
<div class="space-y-6">
    <div class="flex items-center justify-between">
        <h1 class="text-2xl font-extrabold text-gray-900">{{ __('admin.edit') }} - {{ $coupon->code }}</h1>
        <a href="{{ route('admin.coupons.index') }}" class="text-sm text-gray-500 hover:text-indigo-600">{{ __('admin.back_to_list') }}</a>
    </div>
    <form action="{{ route('admin.coupons.update', $coupon->id) }}" method="POST">
        @csrf @method('PUT')
        @include('admin.coupons._form', ['coupon' => $coupon])
    </form>
</div>
@endsection
