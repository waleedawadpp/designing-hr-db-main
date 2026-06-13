<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_products_endpoint_returns_active_products(): void
    {
        $category = Category::factory()->create();
        Product::factory(3)->create(['status' => true, 'category_id' => $category->id]);
        Product::factory()->create(['status' => false, 'category_id' => $category->id]);

        $response = $this->getJson('/api/v1/products');

        $response->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonStructure(['data' => [['id', 'name', 'price', 'effective_price', 'in_stock']]]);
    }

    public function test_product_can_be_fetched_by_slug(): void
    {
        $product = Product::factory()->create(['status' => true, 'slug' => 'demo-product']);

        $this->getJson('/api/v1/products/demo-product')
            ->assertOk()
            ->assertJsonPath('data.slug', 'demo-product');
    }

    public function test_categories_endpoint_returns_tree(): void
    {
        Category::factory(2)->create(['status' => true]);

        $this->getJson('/api/v1/categories')
            ->assertOk()
            ->assertJsonStructure(['data' => [['id', 'name', 'slug']]]);
    }

    public function test_products_can_be_filtered_and_sorted(): void
    {
        $category = Category::factory()->create();
        Product::factory()->create(['status' => true, 'price' => 10, 'category_id' => $category->id]);
        Product::factory()->create(['status' => true, 'price' => 90, 'category_id' => $category->id]);

        $response = $this->getJson('/api/v1/products?sort=price_asc')->assertOk();
        $prices = array_column($response->json('data'), 'price');
        $this->assertSame($prices, array_values(collect($prices)->sort()->all()));
    }
}
