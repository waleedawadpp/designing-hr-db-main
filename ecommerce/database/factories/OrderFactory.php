<?php

namespace Database\Factories;

use App\Models\Order;
use Illuminate\Database\Eloquent\Factories\Factory;

class OrderFactory extends Factory
{
    protected $model = Order::class;

    public function definition(): array
    {
        $subtotal = $this->faker->randomFloat(2, 50, 1000);
        $tax = round($subtotal * 0.05, 2);

        return [
            'order_number' => 'ORD-'.now()->format('Ymd').'-'.str_pad((string) $this->faker->unique()->numberBetween(1, 999999), 6, '0', STR_PAD_LEFT),
            'customer_name' => $this->faker->name(),
            'phone' => $this->faker->numerify('+1##########'),
            'email' => $this->faker->safeEmail(),
            'address' => $this->faker->address(),
            'city' => $this->faker->city(),
            'country' => $this->faker->country(),
            'subtotal' => $subtotal,
            'tax' => $tax,
            'shipping' => 10,
            'discount' => 0,
            'total' => $subtotal + $tax + 10,
            'status' => $this->faker->randomElement(Order::STATUSES),
        ];
    }
}
