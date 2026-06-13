<?php

namespace Tests\Unit;

use App\Models\Coupon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CouponTest extends TestCase
{
    use RefreshDatabase;

    public function test_percentage_discount_is_calculated(): void
    {
        $coupon = Coupon::factory()->create(['type' => 'percentage', 'value' => 20]);
        $this->assertEqualsWithDelta(20.0, $coupon->discountFor(100), 0.001);
    }

    public function test_fixed_discount_never_exceeds_amount(): void
    {
        $coupon = Coupon::factory()->create(['type' => 'fixed', 'value' => 150]);
        $this->assertEqualsWithDelta(100.0, $coupon->discountFor(100), 0.001);
    }

    public function test_expired_coupon_is_invalid(): void
    {
        $coupon = Coupon::factory()->create([
            'start_date' => now()->subDays(10),
            'end_date' => now()->subDay(),
        ]);
        $this->assertFalse($coupon->isValid(100));
    }

    public function test_min_order_amount_is_enforced(): void
    {
        $coupon = Coupon::factory()->create(['min_order_amount' => 200, 'status' => true, 'start_date' => null, 'end_date' => null, 'usage_limit' => null]);
        $this->assertFalse($coupon->isValid(100));
        $this->assertTrue($coupon->isValid(250));
    }
}
