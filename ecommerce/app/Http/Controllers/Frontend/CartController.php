<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Services\CartService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class CartController extends Controller
{
    public function __construct(private readonly CartService $cart)
    {
    }

    public function index(): View
    {
        return view('frontend.cart.index', [
            'lines' => $this->cart->lines(),
            'summary' => $this->cart->summary(),
        ]);
    }

    public function add(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'product_id' => ['required', 'exists:products,id'],
            'quantity' => ['nullable', 'integer', 'min:1', 'max:999'],
        ]);

        $this->cart->add($data['product_id'], $data['quantity'] ?? 1);

        return back()->with('success', __('shop.added_to_cart'));
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'product_id' => ['required', 'integer'],
            'quantity' => ['required', 'integer', 'min:0', 'max:999'],
        ]);

        $this->cart->update($data['product_id'], $data['quantity']);

        return back()->with('success', __('shop.cart_updated'));
    }

    public function remove(int $productId): RedirectResponse
    {
        $this->cart->remove($productId);
        return back()->with('success', __('shop.removed_from_cart'));
    }

    public function saveForLater(int $productId): RedirectResponse
    {
        $this->cart->saveForLater($productId);
        return back();
    }

    public function applyCoupon(Request $request): RedirectResponse
    {
        $request->validate(['code' => ['required', 'string', 'max:64']]);

        if ($this->cart->applyCoupon($request->string('code'))) {
            return back()->with('success', __('shop.coupon_applied'));
        }

        return back()->with('error', __('shop.coupon_invalid'));
    }

    public function removeCoupon(): RedirectResponse
    {
        $this->cart->removeCoupon();
        return back();
    }
}
