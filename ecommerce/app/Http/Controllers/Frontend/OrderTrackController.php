<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\InvoiceService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class OrderTrackController extends Controller
{
    public function form(): View
    {
        return view('frontend.orders.track');
    }

    public function track(Request $request): View
    {
        $request->validate(['order_number' => ['required', 'string']]);

        $order = Order::with('items')->where('order_number', $request->order_number)->firstOrFail();

        return view('frontend.orders.show', compact('order'));
    }

    public function show(string $orderNumber): View
    {
        $order = Order::with('items')->where('order_number', $orderNumber)->firstOrFail();

        return view('frontend.orders.show', compact('order'));
    }

    public function invoice(string $orderNumber, InvoiceService $invoices): StreamedResponse|BinaryFileResponse
    {
        $order = Order::where('order_number', $orderNumber)->firstOrFail();

        if (! $order->invoice_path || ! Storage::disk('public')->exists($order->invoice_path)) {
            $invoices->regenerate($order);
            $order->refresh();
        }

        return Storage::disk('public')->download($order->invoice_path, $order->order_number.'.pdf');
    }
}
