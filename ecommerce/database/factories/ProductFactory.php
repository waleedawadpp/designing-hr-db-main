<?php

namespace Database\Factories;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class ProductFactory extends Factory
{
    protected $model = Product::class;

    public function definition(): array
    {
        $en = $this->faker->unique()->words(3, true);
        $price = $this->faker->randomFloat(2, 10, 1000);

        return [
            'sku' => 'SKU-'.strtoupper(Str::random(8)),
            'slug' => Str::slug($en).'-'.Str::random(4),
            'name_en' => ucwords($en),
            'name_ar' => 'منتج '.$this->faker->word(),
            'description_en' => $this->faker->paragraphs(3, true),
            'description_ar' => 'وصف المنتج بالتفصيل. '.$this->faker->sentence(),
            'short_description_en' => $this->faker->sentence(),
            'short_description_ar' => 'وصف مختصر للمنتج.',
            'price' => $price,
            'sale_price' => $this->faker->boolean(30) ? round($price * 0.8, 2) : null,
            'stock' => $this->faker->numberBetween(0, 200),
            'status' => true,
            'featured' => $this->faker->boolean(25),
            'category_id' => Category::factory(),
            'views' => $this->faker->numberBetween(0, 5000),
        ];
    }

    public function featured(): static
    {
        return $this->state(fn () => ['featured' => true]);
    }

    public function outOfStock(): static
    {
        return $this->state(fn () => ['stock' => 0]);
    }
}
