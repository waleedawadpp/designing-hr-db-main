<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Product;
use App\Services\CartService;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CheckoutTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\SettingsSeeder::class);
        Storage::fake('public');
        Mail::fake();
    }

    public function test_placing_an_order_creates_records_and_invoice_and_decrements_stock(): void
    {
        $product = Product::factory()->create(['price' => 100, 'sale_price' => null, 'stock' => 5, 'status' => true]);

        $cart = app(CartService::class);
        $cart->add($product->id, 2);

        $order = app(OrderService::class)->placeOrder([
            'customer_name' => 'Jane Doe',
            'phone' => '+1234567890',
            'email' => 'jane@example.com',
            'address' => '1 Main St',
            'city' => 'Metropolis',
            'country' => 'US',
        ]);

        $this->assertDatabaseHas('orders', ['order_number' => $order->order_number, 'customer_name' => 'Jane Doe']);
        $this->assertDatabaseHas('order_items', ['order_id' => $order->id, 'quantity' => 2]);

        $this->assertSame(3, $product->fresh()->stock);
        $this->assertNotNull($order->invoice_path);
        Storage::disk('public')->assertExists($order->invoice_path);
        Mail::assertSent(\App\Mail\OrderPlacedMail::class);
    }

    public function test_order_total_includes_tax_and_shipping(): void
    {
        $product = Product::factory()->create(['price' => 200, 'sale_price' => null, 'stock' => 10, 'status' => true]);
        $cart = app(CartService::class);
        $cart->add($product->id, 1);

        $order = app(OrderService::class)->placeOrder([
            'customer_name' => 'John',
            'phone' => '+1234567890',
            'email' => 'john@example.com',
            'address' => 'Street 5',
        ]);

        // SettingsSeeder: tax 5%, flat shipping 10
        $this->assertEqualsWithDelta(10.0, (float) $order->tax, 0.01);
        $this->assertEqualsWithDelta(10.0, (float) $order->shipping, 0.01);
        $this->assertEqualsWithDelta(220.0, (float) $order->total, 0.01);
    }

    public function test_checkout_redirects_when_cart_empty(): void
    {
        $this->get(route('checkout.index'))
            ->assertRedirect(route('cart.index'));
    }
}
