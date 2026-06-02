/* ============================================================================
   RAF MARKETPLACE — Reporting & Analytics Views
   Run after schema.sql:  psql -d raf_marketplace -f views.sql

   Implements the spec's Reporting section:
     Business Reports : Revenue / Sales / Vendor / Customer
     AI Reports       : Product trends / Customer trends / Demand forecasting
   Plus operational dashboards (low stock, pending approvals).
   ============================================================================ */

BEGIN;

/* ---- Operational: products needing restock ------------------------------ */
CREATE OR REPLACE VIEW v_low_stock AS
SELECT  pv.variant_id,
        p.product_id,
        p.name_en,
        p.name_ar,
        pv.sku,
        ven.vendor_id,
        ven.store_name_en,
        inv.quantity,
        inv.reserved,
        inv.low_stock_threshold
FROM    inventory       inv
JOIN    product_variant pv  ON pv.variant_id = inv.variant_id
JOIN    product         p   ON p.product_id  = pv.product_id
JOIN    vendor          ven ON ven.vendor_id = p.vendor_id
WHERE   inv.quantity <= inv.low_stock_threshold
AND     p.deleted_at IS NULL;

/* ---- Operational: vendors awaiting admin approval ----------------------- */
CREATE OR REPLACE VIEW v_pending_vendors AS
SELECT  v.vendor_id,
        v.store_name_en,
        v.store_name_ar,
        u.full_name AS owner_name,
        u.email     AS owner_email,
        v.created_at
FROM    vendor   v
JOIN    app_user u ON u.user_id = v.owner_user_id
WHERE   v.status = 'pending';

/* ---- Business: revenue per vendor (paid orders only) -------------------- */
CREATE OR REPLACE VIEW v_vendor_revenue AS
SELECT  oi.vendor_id,
        ven.store_name_en,
        count(DISTINCT oi.order_id)            AS orders_count,
        sum(oi.quantity)                       AS units_sold,
        sum(oi.line_total)                     AS gross_sales,
        sum(oi.commission_amount)              AS platform_commission,
        sum(oi.line_total - oi.commission_amount) AS net_vendor_earnings
FROM    order_item     oi
JOIN    customer_order o   ON o.order_id  = oi.order_id
JOIN    vendor         ven ON ven.vendor_id = oi.vendor_id
JOIN    payment        pay ON pay.order_id = o.order_id AND pay.status = 'paid'
GROUP BY oi.vendor_id, ven.store_name_en;

/* ---- Business: platform revenue by month -------------------------------- */
CREATE OR REPLACE VIEW v_monthly_revenue AS
SELECT  date_trunc('month', o.placed_at)::date AS month,
        count(DISTINCT o.order_id)             AS orders_count,
        sum(o.grand_total)                     AS gross_revenue,
        sum(oi_agg.commission)                 AS platform_commission
FROM    customer_order o
JOIN    payment pay ON pay.order_id = o.order_id AND pay.status = 'paid'
JOIN    LATERAL (
            SELECT sum(commission_amount) AS commission
            FROM   order_item WHERE order_id = o.order_id
        ) oi_agg ON TRUE
GROUP BY 1
ORDER BY 1;

/* ---- Business: top-selling products ------------------------------------- */
CREATE OR REPLACE VIEW v_top_products AS
SELECT  p.product_id,
        p.name_en,
        p.name_ar,
        p.rating_avg,
        sum(oi.quantity)   AS units_sold,
        sum(oi.line_total) AS revenue
FROM    order_item oi
JOIN    product    p ON p.product_id =
            (SELECT product_id FROM product_variant WHERE sku = oi.sku LIMIT 1)
GROUP BY p.product_id, p.name_en, p.name_ar, p.rating_avg
ORDER BY units_sold DESC;

/* ---- Business: customer lifetime value ---------------------------------- */
CREATE OR REPLACE VIEW v_customer_summary AS
SELECT  u.user_id,
        u.full_name,
        u.email,
        count(o.order_id)                 AS orders_count,
        coalesce(sum(o.grand_total), 0)   AS lifetime_value,
        max(o.placed_at)                  AS last_order_at
FROM    app_user u
LEFT JOIN customer_order o ON o.user_id = u.user_id
GROUP BY u.user_id, u.full_name, u.email;

/* ---- AI: product demand vs. forecast ------------------------------------ */
CREATE OR REPLACE VIEW v_demand_forecast AS
SELECT  f.product_id,
        p.name_en,
        f.horizon_date,
        f.predicted_value,
        f.confidence,
        inv.quantity AS current_stock
FROM    ai_forecast f
JOIN    product p           ON p.product_id = f.product_id
LEFT JOIN product_variant pv ON pv.product_id = p.product_id
LEFT JOIN inventory inv      ON inv.variant_id = pv.variant_id
WHERE   f.metric = 'demand';

/* ---- AI: trending products (last 30 days sales velocity) ---------------- */
CREATE OR REPLACE VIEW v_product_trends AS
SELECT  p.product_id,
        p.name_en,
        p.name_ar,
        count(*)         AS recent_orders,
        sum(oi.quantity) AS recent_units
FROM    order_item     oi
JOIN    customer_order o ON o.order_id = oi.order_id
JOIN    product_variant pv ON pv.sku = oi.sku
JOIN    product        p  ON p.product_id = pv.product_id
WHERE   o.placed_at >= now() - INTERVAL '30 days'
GROUP BY p.product_id, p.name_en, p.name_ar
ORDER BY recent_units DESC;

COMMIT;
