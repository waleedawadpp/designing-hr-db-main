<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\CategoryRequest;
use App\Models\Category;
use App\Services\ImageService;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

class CategoryController extends Controller
{
    public function __construct(private readonly ImageService $images)
    {
    }

    public function index(): View
    {
        return view('admin.categories.index', [
            'categories' => Category::with('parent')->withCount('products')->orderBy('sort_order')->paginate(config('shop.admin_per_page')),
        ]);
    }

    public function create(): View
    {
        return view('admin.categories.create', ['parents' => Category::root()->get()]);
    }

    public function store(CategoryRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $data['status'] = $request->boolean('status');
        if ($request->hasFile('image')) {
            $data['image'] = $this->images->store($request->file('image'), 'categories', 600);
        }
        Category::create($data);

        return redirect()->route('admin.categories.index')->with('success', __('admin.created'));
    }

    public function edit(Category $category): View
    {
        return view('admin.categories.edit', [
            'category' => $category,
            'parents' => Category::root()->where('id', '!=', $category->id)->get(),
        ]);
    }

    public function update(CategoryRequest $request, Category $category): RedirectResponse
    {
        $data = $request->validated();
        $data['status'] = $request->boolean('status');
        if ($request->hasFile('image')) {
            $this->images->delete($category->image);
            $data['image'] = $this->images->store($request->file('image'), 'categories', 600);
        }
        $category->update($data);

        return redirect()->route('admin.categories.index')->with('success', __('admin.updated'));
    }

    public function destroy(Category $category): RedirectResponse
    {
        $category->delete();
        return back()->with('success', __('admin.deleted'));
    }
}
