<!DOCTYPE html>
<html dir="{{ current_dir() }}" lang="{{ app()->getLocale() }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title', setting('store_name', config('app.name')))</title>

    @if(setting('favicon'))
        <link rel="icon" href="{{ asset('storage/'.setting('favicon')) }}">
    @endif

    {!! SEO::generate() !!}

    @vite(['resources/css/app.css', 'resources/js/app.js'])
    @stack('styles')
</head>
<body class="font-sans antialiased bg-gray-50 text-gray-800">
    <div class="min-h-screen flex flex-col">
        @include('layouts.partials.frontend.header')

        @include('layouts.partials.frontend.flash')

        <main class="flex-1">
            @hasSection('content')
                @yield('content')
            @else
                {{ $slot ?? '' }}
            @endif
        </main>

        @include('layouts.partials.frontend.footer')
    </div>
    @stack('scripts')
</body>
</html>
