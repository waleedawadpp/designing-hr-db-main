<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Repositories\OrderRepository;
use App\Services\InvoiceService;
use App\Services\OrderService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\View\View;

class OrderController extends Controller
{
    public function __construct(
        private readonly OrderRepository $orders,
        private readonly OrderService $orderService,
    ) {
    }

    public function index(Request $request): View
    {
        $this->authorize('viewAny', Order::class);

        return view('admin.orders.index', [
            'orders' => $this->orders->paginateWithFilters($request->only(['status', 'search'])),
            'statuses' => Order::STATUSES,
        ]);
    }

    public function show(Order $order): View
    {
        $this->authorize('view', $order);
        $order->load('items', 'coupon', 'user');

        return view('admin.orders.show', [
            'order' => $order,
            'statuses' => Order::STATUSES,
        ]);
    }

    public function updateStatus(Request $request, Order $order): RedirectResponse
    {
        $this->authorize('update', $order);
        $request->validate(['status' => ['required', 'in:'.implode(',', Order::STATUSES)]]);

        $this->orderService->updateStatus($order, $request->status);

        return back()->with('success', __('admin.updated'));
    }

    public function invoice(Order $order, InvoiceService $invoices)
    {
        $this->authorize('view', $order);

        if (! $order->invoice_path || ! Storage::disk('public')->exists($order->invoice_path)) {
            $invoices->regenerate($order);
            $order->refresh();
        }

        return Storage::disk('public')->download($order->invoice_path, $order->order_number.'.pdf');
    }

    public function regenerateInvoice(Order $order, InvoiceService $invoices): RedirectResponse
    {
        $this->authorize('update', $order);
        $invoices->regenerate($order);

        return back()->with('success', __('admin.invoice_regenerated'));
    }
}
