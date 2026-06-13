<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ProductRequest;
use App\Models\Category;
use App\Models\Product;
use App\Repositories\ProductRepository;
use App\Services\ImageService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class ProductController extends Controller
{
    public function __construct(
        private readonly ProductRepository $products,
        private readonly ImageService $images,
    ) {
        $this->authorizeResource(Product::class, 'product');
    }

    public function index(Request $request): View
    {
        $query = Product::with('category')->latest();

        if ($search = $request->get('search')) {
            $query->search($search);
        }
        if ($request->boolean('trashed')) {
            $query->onlyTrashed();
        }

        return view('admin.products.index', [
            'products' => $query->paginate(config('shop.admin_per_page'))->withQueryString(),
        ]);
    }

    public function create(): View
    {
        return view('admin.products.create', ['categories' => Category::active()->get()]);
    }

    public function store(ProductRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $data = $this->handleImages($request, $data);

        $this->products->create($data);

        return redirect()->route('admin.products.index')->with('success', __('admin.created'));
    }

    public function edit(Product $product): View
    {
        return view('admin.products.edit', [
            'product' => $product,
            'categories' => Category::active()->get(),
        ]);
    }

    public function update(ProductRequest $request, Product $product): RedirectResponse
    {
        $data = $request->validated();
        $data = $this->handleImages($request, $data, $product);

        $this->products->update($product, $data);

        return redirect()->route('admin.products.index')->with('success', __('admin.updated'));
    }

    public function destroy(Product $product): RedirectResponse
    {
        $product->delete();
        return back()->with('success', __('admin.deleted'));
    }

    public function restore(int $id): RedirectResponse
    {
        Product::withTrashed()->findOrFail($id)->restore();
        return back()->with('success', __('admin.restored'));
    }

    public function bulk(Request $request): RedirectResponse
    {
        $request->validate([
            'action' => ['required', 'in:delete,activate,deactivate,feature'],
            'ids' => ['required', 'array'],
            'ids.*' => ['integer'],
        ]);

        $query = Product::whereIn('id', $request->ids);

        match ($request->action) {
            'delete' => $query->get()->each->delete(),
            'activate' => $query->update(['status' => true]),
            'deactivate' => $query->update(['status' => false]),
            'feature' => $query->update(['featured' => true]),
        };

        return back()->with('success', __('admin.bulk_done'));
    }

    private function handleImages(Request $request, array $data, ?Product $product = null): array
    {
        if ($request->hasFile('main_image')) {
            $this->images->delete($product?->main_image);
            $data['main_image'] = $this->images->store($request->file('main_image'), 'products');
        }

        if ($request->hasFile('gallery')) {
            $gallery = $product?->gallery_images ?? [];
            foreach ($request->file('gallery') as $file) {
                $gallery[] = $this->images->store($file, 'products');
            }
            $data['gallery_images'] = $gallery;
        }

        $data['status'] = $request->boolean('status');
        $data['featured'] = $request->boolean('featured');

        return $data;
    }
}
