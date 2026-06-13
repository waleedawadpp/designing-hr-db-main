<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Banner extends Model
{
    use HasFactory;

    protected $fillable = [
        'title_ar', 'title_en', 'description_ar', 'description_en',
        'image', 'button_text_ar', 'button_text_en', 'button_link',
        'is_active', 'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function getTitleAttribute(): ?string
    {
        return $this->{'title_'.app()->getLocale()} ?? $this->title_en;
    }

    public function getButtonTextAttribute(): ?string
    {
        return $this->{'button_text_'.app()->getLocale()} ?? $this->button_text_en;
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true)->orderBy('sort_order');
    }
}
