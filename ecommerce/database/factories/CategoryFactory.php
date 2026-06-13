<?php

namespace Database\Factories;

use App\Models\Category;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class CategoryFactory extends Factory
{
    protected $model = Category::class;

    public function definition(): array
    {
        $en = $this->faker->unique()->words(2, true);

        return [
            'name_en' => ucwords($en),
            'name_ar' => 'تصنيف '.$this->faker->word(),
            'slug' => Str::slug($en).'-'.Str::random(4),
            'parent_id' => null,
            'status' => true,
            'sort_order' => $this->faker->numberBetween(0, 20),
        ];
    }
}
