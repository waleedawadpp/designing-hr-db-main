<?php

namespace App\Policies;

use App\Models\Order;
use App\Models\User;

class OrderPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('manage orders');
    }

    public function view(User $user, Order $order): bool
    {
        return $user->can('manage orders') || $order->user_id === $user->id;
    }

    public function update(User $user, Order $order): bool
    {
        return $user->can('manage orders');
    }
}
