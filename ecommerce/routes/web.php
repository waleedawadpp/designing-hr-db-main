<?php

use App\Http\Controllers\Frontend\CartController;
use App\Http\Controllers\Frontend\CheckoutController;
use App\Http\Controllers\Frontend\HomeController;
use App\Http\Controllers\Frontend\LocaleController;
use App\Http\Controllers\Frontend\OrderTrackController;
use App\Http\Controllers\Frontend\ProductController;
use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;

// Language switching
Route::get('locale/{locale}', [LocaleController::class, 'switch'])->name('locale.switch');

// Home
Route::get('/', [HomeController::class, 'index'])->name('home');

// Catalog
Route::get('/products', [ProductController::class, 'index'])->name('products.index');
Route::get('/products/{slug}', [ProductController::class, 'show'])->name('products.show');

// Cart
Route::controller(CartController::class)->prefix('cart')->name('cart.')->group(function () {
    Route::get('/', 'index')->name('index');
    Route::post('/add', 'add')->name('add');
    Route::patch('/update', 'update')->name('update');
    Route::delete('/{productId}', 'remove')->name('remove');
    Route::post('/{productId}/save-for-later', 'saveForLater')->name('save');
    Route::post('/coupon', 'applyCoupon')->name('coupon');
    Route::delete('/coupon', 'removeCoupon')->name('coupon.remove');
});

// Checkout (rate-limited to curb abuse)
Route::controller(CheckoutController::class)->prefix('checkout')->name('checkout.')->group(function () {
    Route::get('/', 'index')->name('index');
    Route::post('/', 'store')->middleware('throttle:10,1')->name('store');
    Route::get('/success/{orderNumber}', 'success')->name('success');
});

// Order tracking + invoice
Route::controller(OrderTrackController::class)->prefix('orders')->name('orders.')->group(function () {
    Route::get('/track', 'form')->name('track.form');
    Route::post('/track', 'track')->name('track.submit');
    Route::get('/{orderNumber}', 'show')->name('track');
    Route::get('/{orderNumber}/invoice', 'invoice')->name('invoice');
});

// Authenticated profile (Breeze)
Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';
