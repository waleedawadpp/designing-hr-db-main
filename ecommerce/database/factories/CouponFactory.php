<?php

namespace Database\Factories;

use App\Models\Coupon;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class CouponFactory extends Factory
{
    protected $model = Coupon::class;

    public function definition(): array
    {
        return [
            'code' => strtoupper(Str::random(8)),
            'type' => $this->faker->randomElement(['percentage', 'fixed']),
            'value' => $this->faker->randomElement([10, 15, 20, 25]),
            'min_order_amount' => $this->faker->randomElement([null, 50, 100]),
            'start_date' => now()->subDay(),
            'end_date' => now()->addMonth(),
            'usage_limit' => $this->faker->randomElement([null, 100]),
            'used_count' => 0,
            'status' => true,
        ];
    }
}
