<?php

namespace App\Services;

use App\Models\Coupon;
use App\Repositories\CouponRepository;

class CouponService
{
    public function __construct(private readonly CouponRepository $repository)
    {
    }

    public function resolve(string $code, float $orderAmount): ?Coupon
    {
        $coupon = $this->repository->findActiveByCode($code);
        if ($coupon && $coupon->isValid($orderAmount)) {
            return $coupon;
        }
        return null;
    }

    public function discountFor(string $code, float $amount): float
    {
        $coupon = $this->resolve($code, $amount);
        return $coupon ? $coupon->discountFor($amount) : 0.0;
    }
}
