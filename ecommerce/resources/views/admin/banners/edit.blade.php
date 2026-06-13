@extends('layouts.admin')

@section('title', __('admin.edit').' - '.$banner->title)

@section('content')
<div class="space-y-6">
    <div class="flex items-center justify-between">
        <h1 class="text-2xl font-extrabold text-gray-900">{{ __('admin.edit') }} - {{ $banner->title }}</h1>
        <a href="{{ route('admin.banners.index') }}" class="text-sm text-gray-500 hover:text-indigo-600">{{ __('admin.back_to_list') }}</a>
    </div>
    <form action="{{ route('admin.banners.update', $banner->id) }}" method="POST" enctype="multipart/form-data">
        @csrf @method('PUT')
        @include('admin.banners._form', ['banner' => $banner])
    </form>
</div>
@endsection
