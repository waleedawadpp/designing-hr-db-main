<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $permissions = [
            'manage products',
            'manage categories',
            'manage orders',
            'manage coupons',
            'manage banners',
            'manage media',
            'manage settings',
            'manage users',
            'view dashboard',
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }

        $superAdmin = Role::firstOrCreate(['name' => 'Super Admin']);
        $superAdmin->syncPermissions(Permission::all());

        $admin = Role::firstOrCreate(['name' => 'Admin']);
        $admin->syncPermissions([
            'manage products', 'manage categories', 'manage orders',
            'manage settings', 'view dashboard',
        ]);

        $content = Role::firstOrCreate(['name' => 'Content Manager']);
        $content->syncPermissions([
            'manage products', 'manage categories', 'manage banners',
            'manage media', 'view dashboard',
        ]);

        Role::firstOrCreate(['name' => 'Customer']);
    }
}
