@extends('layouts.admin')

@section('title', __('admin.edit').' - '.$product->name)

@section('content')
<div class="space-y-6">
    <div class="flex items-center justify-between">
        <h1 class="text-2xl font-extrabold text-gray-900">{{ __('admin.edit') }} - {{ $product->name }}</h1>
        <a href="{{ route('admin.products.index') }}" class="text-sm text-gray-500 hover:text-indigo-600">{{ __('admin.back_to_list') }}</a>
    </div>

    <form action="{{ route('admin.products.update', $product->id) }}" method="POST" enctype="multipart/form-data">
        @csrf @method('PUT')
        @include('admin.products._form', ['product' => $product])
    </form>
</div>
@endsection
