<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Models\Banner;
use App\Repositories\CategoryRepository;
use App\Repositories\ProductRepository;
use Artesaos\SEOTools\Facades\SEOTools;
use Illuminate\View\View;

class HomeController extends Controller
{
    public function __construct(
        private readonly ProductRepository $products,
        private readonly CategoryRepository $categories,
    ) {
    }

    public function index(): View
    {
        SEOTools::setTitle(setting('store_name', config('app.name')));
        SEOTools::setDescription((string) setting('meta_description', ''));
        SEOTools::opengraph()->setType('website');

        return view('frontend.home', [
            'banners' => Banner::active()->get(),
            'featured' => $this->products->featured(8),
            'categories' => $this->categories->activeWithCounts(),
        ]);
    }
}
