<?php

namespace App\Mail;

use App\Models\Order;
use App\Services\InvoiceService;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class OrderPlacedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Order $order)
    {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: __('mail.order_subject', ['number' => $this->order->order_number]),
        );
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.order-placed');
    }

    public function attachments(): array
    {
        $path = app(InvoiceService::class)->absolutePath($this->order);
        if (! $path || ! file_exists($path)) {
            return [];
        }
        return [
            Attachment::fromPath($path)->as($this->order->order_number.'.pdf')->withMime('application/pdf'),
        ];
    }
}
