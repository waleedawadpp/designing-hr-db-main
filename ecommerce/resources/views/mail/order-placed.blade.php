<x-mail::message>
# {{ __('mail.order_greeting') }}

{{ __('mail.order_intro') }}

**{{ __('shop.order_number') }}:** {{ $order->order_number }}

## {{ __('mail.order_details') }}

<x-mail::table>
| {{ __('admin.product') }} | {{ __('admin.quantity') }} | {{ __('admin.total') }} |
| :--- | :---: | ---: |
@foreach($order->items as $item)
| {{ $item->product_name }} | {{ $item->quantity }} | {{ money($item->total) }} |
@endforeach
</x-mail::table>

**{{ __('shop.total') }}: {{ money($order->total) }}**

{{ __('mail.invoice_attached') }}

<x-mail::button :url="route('orders.track', $order->order_number)">
{{ __('shop.track_order') }}
</x-mail::button>

{{ __('mail.thanks') }}

{{ setting('store_name', config('app.name')) }}
</x-mail::message>
