<?php

namespace Database\Factories;

use App\Models\Banner;
use Illuminate\Database\Eloquent\Factories\Factory;

class BannerFactory extends Factory
{
    protected $model = Banner::class;

    public function definition(): array
    {
        return [
            'title_en' => $this->faker->catchPhrase(),
            'title_ar' => 'عنوان البانر',
            'description_en' => $this->faker->sentence(),
            'description_ar' => 'وصف البانر',
            'image' => 'banners/placeholder.webp',
            'button_text_en' => 'Shop Now',
            'button_text_ar' => 'تسوق الآن',
            'button_link' => '/products',
            'is_active' => true,
            'sort_order' => $this->faker->numberBetween(0, 5),
        ];
    }
}
