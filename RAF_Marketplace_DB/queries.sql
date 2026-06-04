/* ============================================================================
   RAF MARKETPLACE — Common CRUD & query examples
   Reference snippets for application developers. Not meant to be run top-to-
   bottom as a migration; pick the statements you need.
   ============================================================================ */

/* --------------------------------------------------------------------------
   CREATE
   -------------------------------------------------------------------------- */

-- Register a customer (password already hashed by the app, e.g. bcrypt/argon2)
INSERT INTO app_user (full_name, email, phone, password_hash, preferred_lang, status)
VALUES ('سارة المعمرية', 'sara@example.com', '+96890000000', :pwd_hash, 'ar', 'active')
RETURNING user_id;

-- Add an item to a user's cart (upsert: bump quantity if already present)
INSERT INTO cart_item (cart_id, variant_id, quantity)
VALUES (:cart_id, :variant_id, 1)
ON CONFLICT (cart_id, variant_id)
DO UPDATE SET quantity = cart_item.quantity + EXCLUDED.quantity;

-- Place an order header (totals computed by the app/checkout service)
INSERT INTO customer_order (order_number, user_id, status, subtotal,
                            shipping_total, grand_total, shipping_address_id)
VALUES ('RAF-2026-000123', :user_id, 'pending', 29.900, 1.500, 31.400, :address_id)
RETURNING order_id;

/* --------------------------------------------------------------------------
   READ
   -------------------------------------------------------------------------- */

-- Storefront listing: published products in a category with price & stock
SELECT  p.product_id, p.name_ar, p.name_en, pv.price, pv.sku,
        inv.quantity AS in_stock, p.rating_avg
FROM    product p
JOIN    product_variant pv ON pv.product_id = p.product_id AND pv.is_active
JOIN    inventory inv      ON inv.variant_id = pv.variant_id
WHERE   p.category_id = :category_id
AND     p.status = 'published'
AND     p.deleted_at IS NULL
ORDER BY p.created_at DESC
LIMIT 24 OFFSET :page_offset;

-- Bilingual full-text product search (uses the GIN index from schema.sql)
SELECT  product_id, name_ar, name_en
FROM    product
WHERE   to_tsvector('simple', coalesce(name_ar,'') || ' ' || coalesce(name_en,''))
        @@ plainto_tsquery('simple', :search_term)
AND     status = 'published';

-- Full order detail with line items
SELECT  o.order_number, o.status, o.grand_total,
        oi.product_name, oi.sku, oi.quantity, oi.unit_price, oi.line_total
FROM    customer_order o
JOIN    order_item oi ON oi.order_id = o.order_id
WHERE   o.order_id = :order_id;

-- A user's wishlist
SELECT  p.product_id, p.name_ar, p.name_en, p.base_price
FROM    wishlist_item w
JOIN    product p ON p.product_id = w.product_id
WHERE   w.user_id = :user_id;

-- Latest tracking status for an order's shipments
SELECT  s.tracking_number, s.carrier, e.status, e.location, e.occurred_at
FROM    shipment s
JOIN    shipment_event e ON e.shipment_id = s.shipment_id
WHERE   s.order_id = :order_id
ORDER BY e.occurred_at DESC;

/* --------------------------------------------------------------------------
   UPDATE
   -------------------------------------------------------------------------- */

-- Admin approves a vendor
UPDATE vendor
SET    status = 'approved', approved_by = :admin_user_id, approved_at = now(),
       updated_at = now()
WHERE  vendor_id = :vendor_id;

-- Advance order status
UPDATE customer_order
SET    status = 'shipped', updated_at = now()
WHERE  order_id = :order_id;

-- Reserve stock at checkout (guarded so it never goes negative)
UPDATE inventory
SET    reserved = reserved + :qty, updated_at = now()
WHERE  variant_id = :variant_id
AND    quantity - reserved >= :qty;

-- Recalculate a product's rating after a new review
UPDATE product p
SET    rating_avg   = sub.avg_rating,
       rating_count = sub.cnt
FROM  (SELECT product_id, round(avg(rating),2) AS avg_rating, count(*) AS cnt
       FROM review WHERE product_id = :product_id GROUP BY product_id) sub
WHERE  p.product_id = sub.product_id;

/* --------------------------------------------------------------------------
   DELETE  (prefer soft-delete for catalog/users)
   -------------------------------------------------------------------------- */

-- Soft-delete a product (keeps order history intact)
UPDATE product SET deleted_at = now() WHERE product_id = :product_id;

-- Remove a wishlist entry (hard delete is fine here)
DELETE FROM wishlist_item
WHERE  user_id = :user_id AND product_id = :product_id;

/* --------------------------------------------------------------------------
   REPORTING shortcuts (see views.sql for the reusable views)
   -------------------------------------------------------------------------- */

-- Vendor earnings dashboard
SELECT * FROM v_vendor_revenue WHERE vendor_id = :vendor_id;

-- Items that need restocking
SELECT * FROM v_low_stock WHERE vendor_id = :vendor_id;

-- Platform revenue trend
SELECT * FROM v_monthly_revenue;
