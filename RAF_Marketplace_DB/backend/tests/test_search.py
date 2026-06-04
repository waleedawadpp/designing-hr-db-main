"""Advanced product search: price range, brand filter, in-stock, sorting."""

from __future__ import annotations

from decimal import Decimal


def _make_brand(db, slug):
    from orm import Brand
    b = Brand(name_ar="ع", name_en="SearchBrand", slug=slug)
    db.add(b)
    db.flush()
    return b.brand_id


def _make_product(db, brand_id, slug, price, stock):
    from orm import Inventory, Product, ProductStatus, ProductVariant
    p = Product(vendor_id=1, brand_id=brand_id, name_ar="منتج بحث", name_en="Search Item",
                slug=slug, base_price=str(price), status=ProductStatus.published)
    db.add(p)
    db.flush()
    v = ProductVariant(product_id=p.product_id, sku=f"{slug}-sku", price=str(price))
    db.add(v)
    db.flush()
    db.add(Inventory(variant_id=v.variant_id, quantity=stock))
    db.commit()
    return p.product_id


def _setup(db, tag):
    """Three products on a dedicated brand: prices 5/10/15, last one out of stock."""
    brand_id = _make_brand(db, f"srch-brand-{tag}")
    p_lo = _make_product(db, brand_id, f"srch-lo-{tag}", 5, 10)
    p_mid = _make_product(db, brand_id, f"srch-mid-{tag}", 10, 10)
    p_oos = _make_product(db, brand_id, f"srch-oos-{tag}", 15, 0)
    return brand_id, p_lo, p_mid, p_oos


def test_brand_filter_and_price_sort(client, db):
    brand_id, p_lo, p_mid, p_oos = _setup(db, "sort")

    items = client.get(f"/products?brand_id={brand_id}&sort=price_asc").json()["items"]
    prices = [Decimal(str(i["base_price"])) for i in items]
    assert prices == sorted(prices)
    assert [i["product_id"] for i in items] == [p_lo, p_mid, p_oos]

    items = client.get(f"/products?brand_id={brand_id}&sort=price_desc").json()["items"]
    assert [i["product_id"] for i in items] == [p_oos, p_mid, p_lo]


def test_price_range_filter(client, db):
    brand_id, p_lo, p_mid, p_oos = _setup(db, "range")
    items = client.get(f"/products?brand_id={brand_id}&min_price=8&max_price=20").json()["items"]
    ids = {i["product_id"] for i in items}
    assert ids == {p_mid, p_oos}
    assert p_lo not in ids


def test_in_stock_filter_excludes_out_of_stock(client, db):
    brand_id, p_lo, p_mid, p_oos = _setup(db, "stock")
    items = client.get(f"/products?brand_id={brand_id}&in_stock=true").json()["items"]
    ids = {i["product_id"] for i in items}
    assert p_lo in ids and p_mid in ids
    assert p_oos not in ids


def test_invalid_sort_rejected(client):
    assert client.get("/products?sort=bogus").status_code == 422
