@extends('layouts.admin')

@section('title', __('admin.edit').' - '.$category->name)

@section('content')
<div class="space-y-6">
    <div class="flex items-center justify-between">
        <h1 class="text-2xl font-extrabold text-gray-900">{{ __('admin.edit') }} - {{ $category->name }}</h1>
        <a href="{{ route('admin.categories.index') }}" class="text-sm text-gray-500 hover:text-indigo-600">{{ __('admin.back_to_list') }}</a>
    </div>
    <form action="{{ route('admin.categories.update', $category->id) }}" method="POST" enctype="multipart/form-data">
        @csrf @method('PUT')
        @include('admin.categories._form', ['category' => $category])
    </form>
</div>
@endsection
