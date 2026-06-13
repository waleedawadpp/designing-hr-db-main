<?php

namespace App\Http\Requests\Frontend;

use Illuminate\Foundation\Http\FormRequest;

class CheckoutRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'customer_name' => ['required', 'string', 'max:191'],
            'phone' => ['required', 'string', 'regex:/^[+0-9\s\-()]{6,20}$/'],
            'email' => ['required', 'email', 'max:191'],
            'address' => ['required', 'string', 'max:500'],
            'city' => ['nullable', 'string', 'max:191'],
            'country' => ['nullable', 'string', 'max:191'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
