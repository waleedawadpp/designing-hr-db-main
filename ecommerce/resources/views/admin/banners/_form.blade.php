@php $banner = $banner ?? null; @endphp

<div class="bg-white rounded-2xl border border-gray-100 card-shadow p-6 space-y-5 max-w-3xl">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.title_en') }}</label>
            <input type="text" name="title_en" value="{{ old('title_en', $banner->title_en ?? '') }}" class="w-full rounded-xl border-gray-200 @error('title_en') border-rose-400 @enderror">
            @error('title_en')<p class="text-xs text-rose-500 mt-1">{{ $message }}</p>@enderror
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.title_ar') }}</label>
            <input type="text" name="title_ar" value="{{ old('title_ar', $banner->title_ar ?? '') }}" dir="rtl" class="w-full rounded-xl border-gray-200 @error('title_ar') border-rose-400 @enderror">
            @error('title_ar')<p class="text-xs text-rose-500 mt-1">{{ $message }}</p>@enderror
        </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.description_en') }}</label>
            <textarea name="description_en" rows="2" class="w-full rounded-xl border-gray-200">{{ old('description_en', $banner->description_en ?? '') }}</textarea>
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.description_ar') }}</label>
            <textarea name="description_ar" rows="2" dir="rtl" class="w-full rounded-xl border-gray-200">{{ old('description_ar', $banner->description_ar ?? '') }}</textarea>
        </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.button_text_en') }}</label>
            <input type="text" name="button_text_en" value="{{ old('button_text_en', $banner->button_text_en ?? '') }}" class="w-full rounded-xl border-gray-200">
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.button_text_ar') }}</label>
            <input type="text" name="button_text_ar" value="{{ old('button_text_ar', $banner->button_text_ar ?? '') }}" dir="rtl" class="w-full rounded-xl border-gray-200">
        </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.button_link') }}</label>
            <input type="text" name="button_link" value="{{ old('button_link', $banner->button_link ?? '') }}" class="w-full rounded-xl border-gray-200">
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.sort_order') }}</label>
            <input type="number" name="sort_order" value="{{ old('sort_order', $banner->sort_order ?? 0) }}" class="w-full rounded-xl border-gray-200">
        </div>
    </div>

    <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.image') }}</label>
        @if($banner && $banner->image)
            <img src="{{ asset('storage/'.$banner->image) }}" class="h-24 w-48 rounded-xl object-cover mb-2 border border-gray-100" alt="">
        @endif
        <input type="file" name="image" accept="image/*" class="w-full text-sm @error('image') text-rose-500 @enderror">
        @error('image')<p class="text-xs text-rose-500 mt-1">{{ $message }}</p>@enderror
    </div>

    <label class="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" name="is_active" value="1" @checked(old('is_active', $banner->is_active ?? true)) class="rounded border-gray-300 text-indigo-600">
        {{ __('admin.is_active') }}
    </label>
</div>

<div class="flex items-center gap-3 mt-6">
    <button type="submit" class="rounded-full bg-gray-900 text-white font-semibold px-8 py-3 hover:bg-indigo-600 transition">{{ __('admin.save') }}</button>
    <a href="{{ route('admin.banners.index') }}" class="rounded-full border border-gray-200 text-gray-600 font-semibold px-8 py-3 hover:bg-gray-50 transition">{{ __('admin.cancel') }}</a>
</div>
