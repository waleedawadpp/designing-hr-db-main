<?php

namespace Database\Seeders;

use App\Models\Banner;
use App\Models\Category;
use App\Models\Coupon;
use App\Models\Product;
use Illuminate\Database\Seeder;

class CatalogSeeder extends Seeder
{
    public function run(): void
    {
        // Root categories, each with children and products.
        $roots = Category::factory(5)->create();

        foreach ($roots as $root) {
            $children = Category::factory(rand(2, 3))->create(['parent_id' => $root->id]);

            Product::factory(rand(4, 8))->create(['category_id' => $root->id]);
            foreach ($children as $child) {
                Product::factory(rand(3, 6))->create(['category_id' => $child->id]);
            }
        }

        Product::factory(6)->featured()->create([
            'category_id' => $roots->random()->id,
        ]);

        Banner::factory(3)->create();

        Coupon::factory()->create(['code' => 'WELCOME10', 'type' => 'percentage', 'value' => 10]);
        Coupon::factory()->create(['code' => 'SAVE50', 'type' => 'fixed', 'value' => 50, 'min_order_amount' => 200]);
    }
}
