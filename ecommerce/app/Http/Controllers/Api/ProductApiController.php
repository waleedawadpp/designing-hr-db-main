<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Repositories\ProductRepository;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ProductApiController extends Controller
{
    public function __construct(private readonly ProductRepository $products)
    {
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->only(['search', 'category', 'min_price', 'max_price', 'sort']);

        return ProductResource::collection($this->products->catalog($filters));
    }

    public function show(string $slug): ProductResource
    {
        return new ProductResource($this->products->findBySlug($slug));
    }
}
