<?php

namespace App\View\Composers;

use App\Models\Setting;
use App\Services\CartService;
use Illuminate\View\View;

class GlobalComposer
{
    public function __construct(private readonly CartService $cart)
    {
    }

    public function compose(View $view): void
    {
        $view->with([
            'globalSettings' => Setting::cached(),
            'cartCount' => $this->cart->count(),
        ]);
    }
}
