<?php

namespace App\Repositories;

use App\Models\Category;
use Illuminate\Support\Collection;

class CategoryRepository extends BaseRepository
{
    public function __construct(Category $model)
    {
        $this->model = $model;
    }

    public function tree(): Collection
    {
        return $this->model->newQuery()->active()->root()->with('children')->orderBy('sort_order')->get();
    }

    public function activeWithCounts(): Collection
    {
        return $this->model->newQuery()->active()->withCount('products')->orderBy('sort_order')->get();
    }

    public function findBySlug(string $slug): Category
    {
        return $this->model->newQuery()->active()->where('slug', $slug)->firstOrFail();
    }
}
