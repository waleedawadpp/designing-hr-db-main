@extends('layouts.admin')

@section('title', __('admin.create').' - '.__('admin.coupons'))

@section('content')
<div class="space-y-6">
    <div class="flex items-center justify-between">
        <h1 class="text-2xl font-extrabold text-gray-900">{{ __('admin.create') }} - {{ __('admin.coupons') }}</h1>
        <a href="{{ route('admin.coupons.index') }}" class="text-sm text-gray-500 hover:text-indigo-600">{{ __('admin.back_to_list') }}</a>
    </div>
    <form action="{{ route('admin.coupons.store') }}" method="POST">
        @csrf
        @include('admin.coupons._form')
    </form>
</div>
@endsection
