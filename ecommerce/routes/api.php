<?php

use App\Http\Controllers\Api\CategoryApiController;
use App\Http\Controllers\Api\ProductApiController;
use Illuminate\Support\Facades\Route;

/*
| Public read-only storefront API (v1). Throttled to 60 req/min.
*/
Route::prefix('v1')->middleware('throttle:60,1')->group(function () {
    Route::get('products', [ProductApiController::class, 'index']);
    Route::get('products/{slug}', [ProductApiController::class, 'show']);
    Route::get('categories', [CategoryApiController::class, 'index']);
});
