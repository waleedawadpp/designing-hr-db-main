<!DOCTYPE html>
@php
    $currency = (isset($settings) && method_exists($settings, 'get')) ? $settings->get('currency', 'USD') : 'USD';
    $storeName = (isset($settings) && method_exists($settings, 'get')) ? $settings->get('store_name', config('app.name')) : config('app.name');
    $logo = (isset($settings) && method_exists($settings, 'get')) ? $settings->get('logo') : null;
    $fmt = fn($n) => number_format((float) $n, 2).' '.$currency;
    $rtl = ($order->locale ?? null) === 'ar';
@endphp
<html @if($rtl) dir="rtl" @endif>
<head>
    <meta charset="utf-8">
    <style>
        * { font-family: DejaVu Sans, sans-serif; }
        body { color: #1f2937; font-size: 13px; margin: 0; padding: 32px; }
        .header { width: 100%; border-bottom: 2px solid #4f46e5; padding-bottom: 16px; margin-bottom: 24px; }
        .header td { vertical-align: top; }
        .store-name { font-size: 22px; font-weight: bold; color: #111827; }
        .invoice-title { font-size: 26px; font-weight: bold; color: #4f46e5; text-align: right; }
        .muted { color: #6b7280; }
        .section { margin-bottom: 20px; }
        .box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; }
        h3 { font-size: 13px; text-transform: uppercase; letter-spacing: .5px; color: #6b7280; margin: 0 0 8px; }
        table.items { width: 100%; border-collapse: collapse; margin-top: 8px; }
        table.items th { background: #111827; color: #fff; padding: 9px 10px; text-align: left; font-size: 12px; }
        table.items td { padding: 9px 10px; border-bottom: 1px solid #e5e7eb; }
        table.items td.num, table.items th.num { text-align: right; }
        .totals { width: 45%; margin-left: auto; margin-top: 16px; }
        .totals td { padding: 5px 10px; }
        .totals .label { color: #6b7280; }
        .totals .num { text-align: right; }
        .grand { font-size: 16px; font-weight: bold; color: #4f46e5; border-top: 2px solid #111827; }
        .footer { margin-top: 36px; text-align: center; color: #9ca3af; font-size: 11px; border-top: 1px solid #e5e7eb; padding-top: 12px; }
        .qr { text-align: center; margin-top: 20px; }
        .qr img { width: 110px; height: 110px; }
    </style>
</head>
<body>
    <table class="header">
        <tr>
            <td style="width: 60%;">
                @if($logo)
                    <img src="{{ public_path('storage/'.$logo) }}" alt="" style="max-height: 50px; margin-bottom: 6px;">
                @endif
                <div class="store-name">{{ $storeName }}</div>
            </td>
            <td style="width: 40%;">
                <div class="invoice-title">INVOICE</div>
                <div class="muted" style="text-align: right;">#{{ $order->order_number }}</div>
                <div class="muted" style="text-align: right;">{{ $order->created_at->format('Y-m-d') }}</div>
            </td>
        </tr>
    </table>

    <div class="section">
        <div class="box">
            <h3>Bill To</h3>
            <strong>{{ $order->customer_name }}</strong><br>
            {{ $order->phone }} &middot; {{ $order->email }}<br>
            {{ $order->address }}<br>
            {{ $order->city }}, {{ $order->country }}
        </div>
    </div>

    <table class="items">
        <thead>
            <tr>
                <th>Product</th>
                <th class="num">Unit Price</th>
                <th class="num">Qty</th>
                <th class="num">Total</th>
            </tr>
        </thead>
        <tbody>
            @foreach($order->items as $item)
                <tr>
                    <td>{{ $item->product_name }}</td>
                    <td class="num">{{ $fmt($item->unit_price) }}</td>
                    <td class="num">{{ $item->quantity }}</td>
                    <td class="num">{{ $fmt($item->total) }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <table class="totals">
        <tr><td class="label">Subtotal</td><td class="num">{{ $fmt($order->subtotal) }}</td></tr>
        @if($order->discount > 0)
            <tr><td class="label">Discount</td><td class="num">- {{ $fmt($order->discount) }}</td></tr>
        @endif
        <tr><td class="label">Tax</td><td class="num">{{ $fmt($order->tax) }}</td></tr>
        <tr><td class="label">Shipping</td><td class="num">{{ $fmt($order->shipping) }}</td></tr>
        <tr class="grand"><td>Total</td><td class="num">{{ $fmt($order->total) }}</td></tr>
    </table>

    @if(!empty($qr))
        <div class="qr">
            <img src="data:image/svg+xml;base64,{{ $qr }}" alt="QR">
        </div>
    @endif

    <div class="footer">
        {{ $storeName }} &middot; Thank you for your business.
    </div>
</body>
</html>
