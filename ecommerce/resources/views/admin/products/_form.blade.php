@php $product = $product ?? null; @endphp

<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    {{-- Main column --}}
    <div class="lg:col-span-2 space-y-6">
        <div class="bg-white rounded-2xl border border-gray-100 card-shadow p-6 space-y-5">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.name_en') }}</label>
                    <input type="text" name="name_en" value="{{ old('name_en', $product->name_en ?? '') }}" class="w-full rounded-xl border-gray-200 @error('name_en') border-rose-400 @enderror">
                    @error('name_en')<p class="text-xs text-rose-500 mt-1">{{ $message }}</p>@enderror
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.name_ar') }}</label>
                    <input type="text" name="name_ar" value="{{ old('name_ar', $product->name_ar ?? '') }}" dir="rtl" class="w-full rounded-xl border-gray-200 @error('name_ar') border-rose-400 @enderror">
                    @error('name_ar')<p class="text-xs text-rose-500 mt-1">{{ $message }}</p>@enderror
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.short_description_en') }}</label>
                    <textarea name="short_description_en" rows="2" class="w-full rounded-xl border-gray-200">{{ old('short_description_en', $product->short_description_en ?? '') }}</textarea>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.short_description_ar') }}</label>
                    <textarea name="short_description_ar" rows="2" dir="rtl" class="w-full rounded-xl border-gray-200">{{ old('short_description_ar', $product->short_description_ar ?? '') }}</textarea>
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.description_en') }}</label>
                    <textarea name="description_en" rows="5" class="w-full rounded-xl border-gray-200">{{ old('description_en', $product->description_en ?? '') }}</textarea>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.description_ar') }}</label>
                    <textarea name="description_ar" rows="5" dir="rtl" class="w-full rounded-xl border-gray-200">{{ old('description_ar', $product->description_ar ?? '') }}</textarea>
                </div>
            </div>
        </div>

        {{-- SEO --}}
        <div class="bg-white rounded-2xl border border-gray-100 card-shadow p-6 space-y-5">
            <h3 class="font-semibold text-gray-900">SEO</h3>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.meta_title') }}</label>
                <input type="text" name="meta_title" value="{{ old('meta_title', $product->meta_title ?? '') }}" class="w-full rounded-xl border-gray-200">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.meta_description') }}</label>
                <textarea name="meta_description" rows="2" class="w-full rounded-xl border-gray-200">{{ old('meta_description', $product->meta_description ?? '') }}</textarea>
            </div>
        </div>
    </div>

    {{-- Sidebar --}}
    <div class="space-y-6">
        <div class="bg-white rounded-2xl border border-gray-100 card-shadow p-6 space-y-5">
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.price') }}</label>
                    <input type="number" step="0.01" name="price" value="{{ old('price', $product->price ?? '') }}" class="w-full rounded-xl border-gray-200 @error('price') border-rose-400 @enderror">
                    @error('price')<p class="text-xs text-rose-500 mt-1">{{ $message }}</p>@enderror
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.sale_price') }}</label>
                    <input type="number" step="0.01" name="sale_price" value="{{ old('sale_price', $product->sale_price ?? '') }}" class="w-full rounded-xl border-gray-200">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.stock') }}</label>
                    <input type="number" name="stock" value="{{ old('stock', $product->stock ?? 0) }}" class="w-full rounded-xl border-gray-200 @error('stock') border-rose-400 @enderror">
                    @error('stock')<p class="text-xs text-rose-500 mt-1">{{ $message }}</p>@enderror
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.sku') }}</label>
                    <input type="text" name="sku" value="{{ old('sku', $product->sku ?? '') }}" class="w-full rounded-xl border-gray-200">
                </div>
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.category') }}</label>
                <select name="category_id" class="w-full rounded-xl border-gray-200 @error('category_id') border-rose-400 @enderror">
                    <option value="">{{ __('admin.select_category') }}</option>
                    @foreach(($categories ?? []) as $cat)
                        <option value="{{ $cat->id }}" @selected((string)old('category_id', $product->category_id ?? '') === (string)$cat->id)>{{ $cat->name }}</option>
                    @endforeach
                </select>
                @error('category_id')<p class="text-xs text-rose-500 mt-1">{{ $message }}</p>@enderror
            </div>

            <div class="space-y-3">
                <label class="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" name="status" value="1" @checked(old('status', $product->status ?? true)) class="rounded border-gray-300 text-indigo-600">
                    {{ __('admin.active') }}
                </label>
                <label class="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" name="featured" value="1" @checked(old('featured', $product->featured ?? false)) class="rounded border-gray-300 text-indigo-600">
                    {{ __('admin.featured') }}
                </label>
            </div>
        </div>

        {{-- Images --}}
        <div class="bg-white rounded-2xl border border-gray-100 card-shadow p-6 space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.main_image') }}</label>
                @if($product && $product->main_image)
                    <img src="{{ asset('storage/'.$product->main_image) }}" class="h-24 w-24 rounded-xl object-cover mb-2 border border-gray-100" alt="">
                @endif
                <input type="file" name="main_image" accept="image/*" class="w-full text-sm">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{{ __('admin.gallery') }}</label>
                <input type="file" name="gallery[]" accept="image/*" multiple class="w-full text-sm">
            </div>
        </div>
    </div>
</div>

<div class="flex items-center gap-3 mt-6">
    <button type="submit" class="rounded-full bg-gray-900 text-white font-semibold px-8 py-3 hover:bg-indigo-600 transition">{{ __('admin.save') }}</button>
    <a href="{{ route('admin.products.index') }}" class="rounded-full border border-gray-200 text-gray-600 font-semibold px-8 py-3 hover:bg-gray-50 transition">{{ __('admin.cancel') }}</a>
</div>
