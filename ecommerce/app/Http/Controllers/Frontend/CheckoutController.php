<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Http\Requests\Frontend\CheckoutRequest;
use App\Services\CartService;
use App\Services\OrderService;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

class CheckoutController extends Controller
{
    public function __construct(
        private readonly CartService $cart,
        private readonly OrderService $orders,
    ) {
    }

    public function index(): View|RedirectResponse
    {
        if ($this->cart->isEmpty()) {
            return redirect()->route('cart.index')->with('error', __('shop.cart_empty'));
        }

        return view('frontend.checkout.index', [
            'lines' => $this->cart->lines(),
            'summary' => $this->cart->summary(),
        ]);
    }

    public function store(CheckoutRequest $request): RedirectResponse
    {
        $order = $this->orders->placeOrder($request->validated());

        return redirect()->route('checkout.success', $order->order_number);
    }

    public function success(string $orderNumber): View
    {
        $order = \App\Models\Order::with('items')->where('order_number', $orderNumber)->firstOrFail();

        return view('frontend.checkout.success', compact('order'));
    }
}
