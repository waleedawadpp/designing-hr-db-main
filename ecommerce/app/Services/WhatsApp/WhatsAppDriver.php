<?php

namespace App\Services\WhatsApp;

interface WhatsAppDriver
{
    /**
     * Send a plain-text WhatsApp message to an E.164 phone number.
     * Returns true on success.
     */
    public function send(string $to, string $message): bool;
}
