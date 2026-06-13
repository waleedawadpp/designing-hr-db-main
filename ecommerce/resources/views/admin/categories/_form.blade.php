@php $category = $category ?? null; @endphp

<div class="bg-white rounded-2xl border border-gray-100 card-shadow p-6 space-y-5 max-w-2xl">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.name_en') }}</label>
            <input type="text" name="name_en" value="{{ old('name_en', $category->name_en ?? '') }}" class="w-full rounded-xl border-gray-200 @error('name_en') border-rose-400 @enderror">
            @error('name_en')<p class="text-xs text-rose-500 mt-1">{{ $message }}</p>@enderror
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.name_ar') }}</label>
            <input type="text" name="name_ar" value="{{ old('name_ar', $category->name_ar ?? '') }}" dir="rtl" class="w-full rounded-xl border-gray-200 @error('name_ar') border-rose-400 @enderror">
            @error('name_ar')<p class="text-xs text-rose-500 mt-1">{{ $message }}</p>@enderror
        </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.parent_category') }}</label>
            <select name="parent_id" class="w-full rounded-xl border-gray-200">
                <option value="">{{ __('admin.no_parent') }}</option>
                @foreach(($parents ?? []) as $parent)
                    @continue($category && $parent->id === $category->id)
                    <option value="{{ $parent->id }}" @selected((string)old('parent_id', $category->parent_id ?? '') === (string)$parent->id)>{{ $parent->name }}</option>
                @endforeach
            </select>
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.sort_order') }}</label>
            <input type="number" name="sort_order" value="{{ old('sort_order', $category->sort_order ?? 0) }}" class="w-full rounded-xl border-gray-200">
        </div>
    </div>

    <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.image') }}</label>
        @if($category && $category->image)
            <img src="{{ asset('storage/'.$category->image) }}" class="h-24 w-24 rounded-xl object-cover mb-2 border border-gray-100" alt="">
        @endif
        <input type="file" name="image" accept="image/*" class="w-full text-sm">
    </div>

    <label class="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" name="status" value="1" @checked(old('status', $category->status ?? true)) class="rounded border-gray-300 text-indigo-600">
        {{ __('admin.active') }}
    </label>
</div>

<div class="flex items-center gap-3 mt-6">
    <button type="submit" class="rounded-full bg-gray-900 text-white font-semibold px-8 py-3 hover:bg-indigo-600 transition">{{ __('admin.save') }}</button>
    <a href="{{ route('admin.categories.index') }}" class="rounded-full border border-gray-200 text-gray-600 font-semibold px-8 py-3 hover:bg-gray-50 transition">{{ __('admin.cancel') }}</a>
</div>
