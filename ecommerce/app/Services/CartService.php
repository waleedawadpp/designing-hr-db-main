<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Session;

/**
 * Session-backed shopping cart. Stores a map of productId => qty
 * plus an applied coupon code. Totals are always recomputed from
 * live product data to avoid price tampering.
 */
class CartService
{
    private const KEY = 'cart.items';
    private const COUPON_KEY = 'cart.coupon';
    private const SAVED_KEY = 'cart.saved';

    public function __construct(private readonly CouponService $coupons)
    {
    }

    public function add(int $productId, int $qty = 1): void
    {
        $items = $this->rawItems();
        $items[$productId] = ($items[$productId] ?? 0) + max(1, $qty);
        $this->persist($items);
    }

    public function update(int $productId, int $qty): void
    {
        $items = $this->rawItems();
        if ($qty <= 0) {
            unset($items[$productId]);
        } else {
            $items[$productId] = $qty;
        }
        $this->persist($items);
    }

    public function remove(int $productId): void
    {
        $items = $this->rawItems();
        unset($items[$productId]);
        $this->persist($items);
    }

    public function saveForLater(int $productId): void
    {
        $items = $this->rawItems();
        if (isset($items[$productId])) {
            $saved = Session::get(self::SAVED_KEY, []);
            $saved[$productId] = $items[$productId];
            Session::put(self::SAVED_KEY, $saved);
            unset($items[$productId]);
            $this->persist($items);
        }
    }

    public function clear(): void
    {
        Session::forget([self::KEY, self::COUPON_KEY]);
    }

    public function applyCoupon(string $code): bool
    {
        $coupon = $this->coupons->resolve($code, $this->subtotal());
        if (! $coupon) {
            return false;
        }
        Session::put(self::COUPON_KEY, $coupon->code);
        return true;
    }

    public function removeCoupon(): void
    {
        Session::forget(self::COUPON_KEY);
    }

    public function couponCode(): ?string
    {
        return Session::get(self::COUPON_KEY);
    }

    /** @return Collection<int, array{product: Product, qty: int, line_total: float}> */
    public function lines(): Collection
    {
        $items = $this->rawItems();
        if (empty($items)) {
            return collect();
        }

        $products = Product::active()->whereIn('id', array_keys($items))->get()->keyBy('id');

        return collect($items)->map(function (int $qty, int $id) use ($products) {
            $product = $products->get($id);
            if (! $product) {
                return null;
            }
            return [
                'product' => $product,
                'qty' => $qty,
                'line_total' => round($product->effective_price * $qty, 2),
            ];
        })->filter()->values();
    }

    public function count(): int
    {
        return array_sum($this->rawItems());
    }

    public function isEmpty(): bool
    {
        return $this->count() === 0;
    }

    public function subtotal(): float
    {
        return (float) $this->lines()->sum('line_total');
    }

    public function discount(): float
    {
        $code = $this->couponCode();
        if (! $code) {
            return 0.0;
        }
        return $this->coupons->discountFor($code, $this->subtotal());
    }

    public function tax(): float
    {
        $rate = (float) \App\Models\Setting::get('tax_percentage', 0);
        $taxable = max(0, $this->subtotal() - $this->discount());
        return round($taxable * ($rate / 100), 2);
    }

    public function shipping(): float
    {
        return (float) \App\Models\Setting::get('flat_shipping', 0);
    }

    public function total(): float
    {
        return round($this->subtotal() - $this->discount() + $this->tax() + $this->shipping(), 2);
    }

    public function summary(): array
    {
        return [
            'subtotal' => $this->subtotal(),
            'discount' => $this->discount(),
            'tax' => $this->tax(),
            'shipping' => $this->shipping(),
            'total' => $this->total(),
            'coupon' => $this->couponCode(),
        ];
    }

    private function rawItems(): array
    {
        return Session::get(self::KEY, []);
    }

    private function persist(array $items): void
    {
        Session::put(self::KEY, $items);
    }
}
