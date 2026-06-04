/* ============================================================================
   RAF MARKETPLACE — Seed / reference data (development)
   Run after schema.sql:  psql -d raf_marketplace -f seed.sql
   ============================================================================ */

BEGIN;

/* ---- Roles & permissions ------------------------------------------------- */
INSERT INTO role (role_key, name_ar, name_en, description) VALUES
    ('customer',     'عميل',          'Customer',      'Marketplace shopper'),
    ('vendor_owner', 'صاحب متجر',     'Vendor Owner',  'Owns and manages a store'),
    ('vendor_staff', 'موظف متجر',     'Vendor Staff',  'Operates a store on behalf of owner'),
    ('admin',        'مدير النظام',   'Administrator', 'Platform administrator');

INSERT INTO permission (perm_key, description) VALUES
    ('product.create',  'Create products'),
    ('product.publish', 'Publish products'),
    ('order.manage',    'Manage orders'),
    ('vendor.approve',  'Approve vendor applications'),
    ('payout.process',  'Process vendor payouts'),
    ('ai.monitor',      'Monitor AI services');

/* admin gets everything; vendor_owner gets store-scoped perms */
INSERT INTO role_permission (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM role r CROSS JOIN permission p
WHERE r.role_key = 'admin';

INSERT INTO role_permission (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM role r JOIN permission p ON p.perm_key IN ('product.create','product.publish','order.manage')
WHERE r.role_key = 'vendor_owner';

/* ---- Geography (Oman) ---------------------------------------------------- */
INSERT INTO country (iso_code, name_ar, name_en) VALUES
    ('OM', 'عُمان',            'Oman'),
    ('AE', 'الإمارات',         'United Arab Emirates'),
    ('SA', 'السعودية',         'Saudi Arabia');

INSERT INTO region (country_id, name_ar, name_en)
SELECT country_id, 'مسقط', 'Muscat' FROM country WHERE iso_code = 'OM';

INSERT INTO city (region_id, name_ar, name_en)
SELECT region_id, 'مسقط', 'Muscat' FROM region WHERE name_en = 'Muscat';

/* ---- Catalog reference --------------------------------------------------- */
INSERT INTO category (name_ar, name_en, slug) VALUES
    ('إلكترونيات', 'Electronics', 'electronics'),
    ('أزياء',      'Fashion',     'fashion'),
    ('مشروبات',    'Beverages',   'beverages');

INSERT INTO brand (name_ar, name_en, slug) VALUES
    ('راف',  'RAF',   'raf'),
    ('عام',  'Generic','generic');

INSERT INTO attribute (code, name_ar, name_en) VALUES
    ('color', 'اللون', 'Color'),
    ('size',  'الحجم', 'Size');

INSERT INTO attribute_value (attribute_id, value_ar, value_en, hex_color)
SELECT attribute_id, 'أحمر', 'Red', '#FF0000' FROM attribute WHERE code = 'color';
INSERT INTO attribute_value (attribute_id, value_ar, value_en, hex_color)
SELECT attribute_id, 'أزرق', 'Blue', '#0000FF' FROM attribute WHERE code = 'color';
INSERT INTO attribute_value (attribute_id, value_ar, value_en)
SELECT attribute_id, 'وسط', 'Medium' FROM attribute WHERE code = 'size';

/* ---- A sample vendor + product ------------------------------------------ */
INSERT INTO app_user (full_name, email, password_hash, status, email_verified)
VALUES ('Vendor Owner', 'owner@example.com', 'x-hash', 'active', TRUE);

INSERT INTO user_role (user_id, role_id)
SELECT u.user_id, r.role_id
FROM app_user u, role r
WHERE u.email = 'owner@example.com' AND r.role_key = 'vendor_owner';

INSERT INTO vendor (owner_user_id, store_name_ar, store_name_en, slug, status, commission_rate)
SELECT user_id, 'متجر تجريبي', 'Demo Store', 'demo-store', 'approved', 8.50
FROM app_user WHERE email = 'owner@example.com';

INSERT INTO vendor_wallet (vendor_id)
SELECT vendor_id FROM vendor WHERE slug = 'demo-store';

INSERT INTO product (vendor_id, category_id, brand_id, name_ar, name_en, slug,
                     base_price, status, tags)
SELECT v.vendor_id, c.category_id, b.brand_id,
       'سماعة لاسلكية', 'Wireless Headphones', 'wireless-headphones',
       29.900, 'published', ARRAY['audio','wireless','bluetooth']
FROM vendor v, category c, brand b
WHERE v.slug = 'demo-store' AND c.slug = 'electronics' AND b.slug = 'raf';

INSERT INTO product_variant (product_id, sku, barcode, price)
SELECT product_id, 'RAF-WH-001', '6291000000017', 29.900
FROM product WHERE slug = 'wireless-headphones';

INSERT INTO inventory (variant_id, quantity)
SELECT variant_id, 100 FROM product_variant WHERE sku = 'RAF-WH-001';

COMMIT;
