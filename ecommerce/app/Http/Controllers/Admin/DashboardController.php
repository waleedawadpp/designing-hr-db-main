<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class DashboardController extends Controller
{
    public function index(): View
    {
        $stats = [
            'products' => Product::count(),
            'orders' => Order::count(),
            'revenue' => Order::where('status', '!=', 'cancelled')->sum('total'),
            'customers' => User::role('Customer')->count(),
            'pending' => Order::where('status', 'pending')->count(),
        ];

        // Monthly revenue for the last 12 months (chart data).
        $monthly = Order::where('status', '!=', 'cancelled')
            ->where('created_at', '>=', now()->subMonths(11)->startOfMonth())
            ->get()
            ->groupBy(fn ($o) => $o->created_at->format('Y-m'))
            ->map(fn ($group) => round($group->sum('total'), 2));

        $months = collect(range(0, 11))
            ->map(fn ($i) => now()->subMonths(11 - $i)->format('Y-m'))
            ->mapWithKeys(fn ($m) => [$m => $monthly->get($m, 0)]);

        // Orders by status (chart data).
        $ordersByStatus = Order::select('status', DB::raw('count(*) as total'))
            ->groupBy('status')->pluck('total', 'status');

        $topProducts = Product::withSum('orderItems as sold', 'quantity')
            ->orderByDesc('sold')->limit(5)->get();

        $recentOrders = Order::latest()->limit(10)->get();

        return view('admin.dashboard', compact(
            'stats', 'months', 'ordersByStatus', 'topProducts', 'recentOrders'
        ));
    }
}
