<?php

namespace App\Repositories;

use App\Models\Coupon;

class CouponRepository extends BaseRepository
{
    public function __construct(Coupon $model)
    {
        $this->model = $model;
    }

    public function findActiveByCode(string $code): ?Coupon
    {
        return $this->model->newQuery()
            ->where('code', $code)
            ->where('status', true)
            ->first();
    }
}
