<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StorefrontTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\SettingsSeeder::class);
    }

    public function test_home_page_loads(): void
    {
        $this->get('/')->assertOk();
    }

    public function test_catalog_page_loads(): void
    {
        Product::factory(3)->create(['status' => true]);
        $this->get(route('products.index'))->assertOk();
    }

    public function test_product_detail_page_loads_and_increments_views(): void
    {
        $product = Product::factory()->create(['status' => true, 'views' => 0]);

        $this->get(route('products.show', $product->slug))->assertOk();
        $this->assertSame(1, $product->fresh()->views);
    }

    public function test_locale_can_be_switched(): void
    {
        $this->get(route('locale.switch', 'en'))->assertRedirect();
        $this->assertSame('en', session('locale'));
    }

    public function test_add_to_cart_works(): void
    {
        $product = Product::factory()->create(['status' => true]);

        $this->post(route('cart.add'), ['product_id' => $product->id, 'quantity' => 2])
            ->assertRedirect();
    }
}
