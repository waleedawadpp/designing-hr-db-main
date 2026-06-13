<?php

namespace Tests\Unit;

use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderNumberTest extends TestCase
{
    use RefreshDatabase;

    public function test_order_number_follows_the_required_format(): void
    {
        $service = app(OrderService::class);
        $number = $service->generateOrderNumber();

        $expected = 'ORD-'.now()->format('Ymd').'-000001';
        $this->assertSame($expected, $number);
        $this->assertMatchesRegularExpression('/^ORD-\d{8}-\d{6}$/', $number);
    }
}
