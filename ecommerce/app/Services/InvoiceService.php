<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Setting;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;
use SimpleSoftwareIO\QrCode\Facades\QrCode;

class InvoiceService
{
    /**
     * Render the order invoice to PDF, store under
     * storage/app/public/invoices and return the relative path.
     */
    public function generate(Order $order): string
    {
        $order->loadMissing('items');

        $qr = base64_encode(QrCode::format('svg')->size(120)->generate(
            route('orders.track', $order->order_number)
        ));

        $pdf = Pdf::loadView('pdf.invoice', [
            'order' => $order,
            'settings' => Setting::cached(),
            'qr' => $qr,
        ])->setPaper('a4');

        $relative = 'invoices/'.$order->order_number.'.pdf';
        Storage::disk('public')->put($relative, $pdf->output());

        return $relative;
    }

    public function regenerate(Order $order): string
    {
        if ($order->invoice_path) {
            Storage::disk('public')->delete($order->invoice_path);
        }
        $path = $this->generate($order);
        $order->update(['invoice_path' => $path]);
        return $path;
    }

    public function absolutePath(Order $order): ?string
    {
        if (! $order->invoice_path) {
            return null;
        }
        return Storage::disk('public')->path($order->invoice_path);
    }
}
