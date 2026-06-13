<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\BannerRequest;
use App\Models\Banner;
use App\Services\ImageService;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

class BannerController extends Controller
{
    public function __construct(private readonly ImageService $images)
    {
    }

    public function index(): View
    {
        return view('admin.banners.index', [
            'banners' => Banner::orderBy('sort_order')->paginate(config('shop.admin_per_page')),
        ]);
    }

    public function create(): View
    {
        return view('admin.banners.create');
    }

    public function store(BannerRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $data['is_active'] = $request->boolean('is_active');
        $data['image'] = $this->images->store($request->file('image'), 'banners', 1920);
        Banner::create($data);

        return redirect()->route('admin.banners.index')->with('success', __('admin.created'));
    }

    public function edit(Banner $banner): View
    {
        return view('admin.banners.edit', compact('banner'));
    }

    public function update(BannerRequest $request, Banner $banner): RedirectResponse
    {
        $data = $request->validated();
        $data['is_active'] = $request->boolean('is_active');
        if ($request->hasFile('image')) {
            $this->images->delete($banner->image);
            $data['image'] = $this->images->store($request->file('image'), 'banners', 1920);
        }
        $banner->update($data);

        return redirect()->route('admin.banners.index')->with('success', __('admin.updated'));
    }

    public function destroy(Banner $banner): RedirectResponse
    {
        $this->images->delete($banner->image);
        $banner->delete();
        return back()->with('success', __('admin.deleted'));
    }
}
