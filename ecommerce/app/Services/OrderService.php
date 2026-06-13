<?php

namespace App\Services;

use App\Models\Coupon;
use App\Models\Order;
use App\Models\Product;
use App\Services\WhatsApp\WhatsAppService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Orchestrates the full order workflow:
 * create order -> generate number -> save items -> calculate totals
 * -> generate PDF invoice -> store path -> email -> WhatsApp -> activity log.
 */
class OrderService
{
    public function __construct(
        private readonly CartService $cart,
        private readonly InvoiceService $invoices,
        private readonly WhatsAppService $whatsapp,
    ) {
    }

    public function placeOrder(array $customer): Order
    {
        $lines = $this->cart->lines();

        abort_if($lines->isEmpty(), 422, __('shop.cart_empty'));

        $summary = $this->cart->summary();
        $couponCode = $this->cart->couponCode();

        $order = DB::transaction(function () use ($lines, $customer, $summary, $couponCode) {
            $coupon = $couponCode ? Coupon::where('code', $couponCode)->lockForUpdate()->first() : null;

            $order = Order::create([
                'order_number' => $this->generateOrderNumber(),
                'user_id' => auth()->id(),
                'customer_name' => $customer['customer_name'],
                'phone' => $customer['phone'],
                'email' => $customer['email'],
                'address' => $customer['address'],
                'city' => $customer['city'] ?? null,
                'country' => $customer['country'] ?? null,
                'notes' => $customer['notes'] ?? null,
                'subtotal' => $summary['subtotal'],
                'tax' => $summary['tax'],
                'shipping' => $summary['shipping'],
                'discount' => $summary['discount'],
                'total' => $summary['total'],
                'coupon_id' => $coupon?->id,
                'status' => 'pending',
            ]);

            foreach ($lines as $line) {
                /** @var Product $product */
                $product = $line['product'];

                // Decrement stock atomically; guard against overselling.
                $affected = Product::where('id', $product->id)
                    ->where('stock', '>=', $line['qty'])
                    ->decrement('stock', $line['qty']);
                abort_if($affected === 0, 422, __('shop.out_of_stock', ['name' => $product->name]));

                $order->items()->create([
                    'product_id' => $product->id,
                    'product_name' => $product->name_en,
                    'product_sku' => $product->sku,
                    'unit_price' => $product->effective_price,
                    'quantity' => $line['qty'],
                    'total' => $line['line_total'],
                ]);
            }

            if ($coupon) {
                $coupon->increment('used_count');
            }

            return $order;
        });

        $order->load('items');

        // Generate + store the PDF invoice.
        $invoicePath = $this->invoices->generate($order);
        $order->update(['invoice_path' => $invoicePath]);

        $this->cart->clear();

        // Side-effects: email + WhatsApp. Failures must not break checkout.
        $this->dispatchNotifications($order);

        activity('order')
            ->performedOn($order)
            ->withProperties(['total' => $order->total])
            ->log('Order placed: '.$order->order_number);

        return $order;
    }

    public function generateOrderNumber(): string
    {
        $prefix = 'ORD-'.now()->format('Ymd').'-';
        $last = Order::where('order_number', 'like', $prefix.'%')
            ->orderByDesc('order_number')
            ->value('order_number');

        $seq = $last ? ((int) substr($last, -6)) + 1 : 1;

        return $prefix.str_pad((string) $seq, 6, '0', STR_PAD_LEFT);
    }

    public function updateStatus(Order $order, string $status): Order
    {
        abort_unless(in_array($status, Order::STATUSES, true), 422);
        $order->update(['status' => $status]);
        activity('order')->performedOn($order)->log("Order {$order->order_number} status: {$status}");
        return $order;
    }

    private function dispatchNotifications(Order $order): void
    {
        try {
            Mail::to($order->email)->send(new \App\Mail\OrderPlacedMail($order));
        } catch (\Throwable $e) {
            Log::warning('Order email failed', ['order' => $order->order_number, 'error' => $e->getMessage()]);
        }

        try {
            $this->whatsapp->sendOrderNotification($order);
        } catch (\Throwable $e) {
            Log::warning('WhatsApp notification failed', ['order' => $order->order_number, 'error' => $e->getMessage()]);
        }
    }
}
