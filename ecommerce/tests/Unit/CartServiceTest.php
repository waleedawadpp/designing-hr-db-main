<?php

namespace Tests\Unit;

use App\Models\Product;
use App\Models\Setting;
use App\Services\CartService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CartServiceTest extends TestCase
{
    use RefreshDatabase;

    private function cart(): CartService
    {
        return app(CartService::class);
    }

    public function test_it_adds_and_counts_items(): void
    {
        $product = Product::factory()->create(['price' => 100, 'sale_price' => null]);

        $cart = $this->cart();
        $cart->add($product->id, 2);

        $this->assertSame(2, $cart->count());
        $this->assertEqualsWithDelta(200.0, $cart->subtotal(), 0.001);
    }

    public function test_it_updates_and_removes_items(): void
    {
        $product = Product::factory()->create(['price' => 50]);
        $cart = $this->cart();

        $cart->add($product->id, 1);
        $cart->update($product->id, 4);
        $this->assertSame(4, $cart->count());

        $cart->remove($product->id);
        $this->assertTrue($cart->isEmpty());
    }

    public function test_it_uses_sale_price_for_totals(): void
    {
        $product = Product::factory()->create(['price' => 100, 'sale_price' => 80]);
        $cart = $this->cart();
        $cart->add($product->id, 1);

        $this->assertEqualsWithDelta(80.0, $cart->subtotal(), 0.001);
    }

    public function test_it_computes_tax_from_settings(): void
    {
        Setting::set('tax_percentage', '10');
        $product = Product::factory()->create(['price' => 200, 'sale_price' => null]);

        $cart = $this->cart();
        $cart->add($product->id, 1);

        $this->assertEqualsWithDelta(20.0, $cart->tax(), 0.001);
    }
}
