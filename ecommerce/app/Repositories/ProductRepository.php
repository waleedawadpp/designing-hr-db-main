<?php

namespace App\Repositories;

use App\Models\Product;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

class ProductRepository extends BaseRepository
{
    public function __construct(Product $model)
    {
        $this->model = $model;
    }

    /**
     * Storefront catalog with search / filter / sort, eager-loaded.
     */
    public function catalog(array $filters): LengthAwarePaginator
    {
        $query = $this->model->newQuery()
            ->active()
            ->with('category')
            ->search($filters['search'] ?? null);

        if (! empty($filters['category'])) {
            $query->where('category_id', $filters['category']);
        }

        if (! empty($filters['min_price'])) {
            $query->where('price', '>=', $filters['min_price']);
        }

        if (! empty($filters['max_price'])) {
            $query->where('price', '<=', $filters['max_price']);
        }

        match ($filters['sort'] ?? 'newest') {
            'price_asc' => $query->orderBy('price'),
            'price_desc' => $query->orderByDesc('price'),
            'popularity' => $query->orderByDesc('views'),
            default => $query->latest(),
        };

        return $query->paginate($filters['per_page'] ?? 12)->withQueryString();
    }

    public function featured(int $limit = 8): Collection
    {
        return $this->model->newQuery()->active()->featured()->latest()->limit($limit)->get();
    }

    public function findBySlug(string $slug): Product
    {
        return $this->model->newQuery()->active()->with(['category', 'images'])->where('slug', $slug)->firstOrFail();
    }

    public function related(Product $product, int $limit = 4): Collection
    {
        return $this->model->newQuery()
            ->active()
            ->where('id', '!=', $product->id)
            ->where('category_id', $product->category_id)
            ->limit($limit)
            ->get();
    }

    public function incrementViews(Product $product): void
    {
        $product->increment('views');
    }
}
