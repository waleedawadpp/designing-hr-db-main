<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Repositories\CategoryRepository;
use App\Repositories\ProductRepository;
use Artesaos\SEOTools\Facades\JsonLd;
use Artesaos\SEOTools\Facades\SEOMeta;
use Artesaos\SEOTools\Facades\OpenGraph;
use Illuminate\Http\Request;
use Illuminate\View\View;

class ProductController extends Controller
{
    public function __construct(
        private readonly ProductRepository $products,
        private readonly CategoryRepository $categories,
    ) {
    }

    public function index(Request $request): View
    {
        $filters = $request->only(['search', 'category', 'min_price', 'max_price', 'sort']);

        SEOMeta::setTitle(__('shop.catalog'));

        return view('frontend.products.index', [
            'products' => $this->products->catalog($filters),
            'categories' => $this->categories->activeWithCounts(),
            'filters' => $filters,
        ]);
    }

    public function show(string $slug): View
    {
        $product = $this->products->findBySlug($slug);
        $this->products->incrementViews($product);

        // SEO: meta + Open Graph + Product JSON-LD structured data.
        SEOMeta::setTitle($product->meta_title ?: $product->name);
        SEOMeta::setDescription($product->meta_description ?: strip_tags((string) $product->short_description));
        SEOMeta::setCanonical(route('products.show', $product->slug));
        OpenGraph::setType('product');
        OpenGraph::setTitle($product->name);
        if ($product->main_image) {
            OpenGraph::addImage(asset('storage/'.$product->main_image));
        }
        JsonLd::setType('Product');
        JsonLd::setTitle($product->name);
        JsonLd::setDescription(strip_tags((string) $product->short_description));
        JsonLd::addValue('sku', $product->sku);
        JsonLd::addValue('offers', [
            '@type' => 'Offer',
            'price' => $product->effective_price,
            'priceCurrency' => setting('currency', 'USD'),
            'availability' => $product->in_stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        ]);

        return view('frontend.products.show', [
            'product' => $product,
            'related' => $this->products->related($product),
        ]);
    }
}
