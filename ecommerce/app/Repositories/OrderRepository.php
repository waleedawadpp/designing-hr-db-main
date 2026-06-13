<?php

namespace App\Repositories;

use App\Models\Order;
use Illuminate\Pagination\LengthAwarePaginator;

class OrderRepository extends BaseRepository
{
    public function __construct(Order $model)
    {
        $this->model = $model;
    }

    public function paginateWithFilters(array $filters): LengthAwarePaginator
    {
        $query = $this->model->newQuery()->with('items')->latest();

        if (! empty($filters['status'])) {
            $query->status($filters['status']);
        }

        if (! empty($filters['search'])) {
            $term = $filters['search'];
            $query->where(function ($q) use ($term) {
                $q->where('order_number', 'like', "%{$term}%")
                    ->orWhere('customer_name', 'like', "%{$term}%")
                    ->orWhere('phone', 'like', "%{$term}%")
                    ->orWhere('email', 'like', "%{$term}%");
            });
        }

        return $query->paginate($filters['per_page'] ?? 15)->withQueryString();
    }

    public function findByNumber(string $number): Order
    {
        return $this->model->newQuery()->with('items')->where('order_number', $number)->firstOrFail();
    }
}
