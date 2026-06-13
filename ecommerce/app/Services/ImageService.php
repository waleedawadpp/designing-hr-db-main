<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\Laravel\Facades\Image;

/**
 * Handles secure image uploads: validates, compresses,
 * converts to WebP and stores on the public disk.
 */
class ImageService
{
    public function store(UploadedFile $file, string $folder, int $maxWidth = 1200): string
    {
        $filename = $folder.'/'.Str::uuid()->toString().'.webp';

        $image = Image::read($file->getRealPath());
        $image->scaleDown(width: $maxWidth);
        $encoded = $image->toWebp(quality: 82);

        Storage::disk('public')->put($filename, (string) $encoded);

        return $filename;
    }

    public function delete(?string $path): void
    {
        if ($path && Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
        }
    }
}
