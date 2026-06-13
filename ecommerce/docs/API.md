# REST API Documentation (v1)

The platform exposes a small, **public, read-only** storefront API for fetching catalog data.
It is intended for headless front-ends, mobile apps and integrations. There is no
authentication and no write access.

## Base URL

```
/api/v1
```

For a production deployment: `https://yourdomain.com/api/v1`.

## Rate limiting

All v1 endpoints are throttled to **60 requests per minute** per client
(`throttle:60,1`). Exceeding the limit returns HTTP `429 Too Many Requests`. The standard
`X-RateLimit-Limit` and `X-RateLimit-Remaining` headers are returned.

## Localization

Responses are localized. The application locale (Arabic by default, English fallback)
determines which `name` / `short_description` values are returned. Set the active locale via
the app's locale mechanism; the API returns the resolved localized strings, not the raw
`*_ar` / `*_en` columns.

## Endpoints

### GET /products

Returns a paginated list of **active** products with their category eager-loaded.

**Query parameters**

| Param | Type | Description |
|---|---|---|
| `search` | string | Matches `name_ar`, `name_en`, `sku`, `description_ar`, `description_en` (LIKE) |
| `category` | int | Filter by `category_id` |
| `min_price` | number | Minimum `price` (inclusive) |
| `max_price` | number | Maximum `price` (inclusive) |
| `sort` | string | One of `newest` (default), `price_asc`, `price_desc`, `popularity` (by view count) |

Results are paginated (12 per page by default) and preserve query parameters across pages.

**Example request**

```
GET /api/v1/products?search=shirt&category=3&min_price=10&max_price=100&sort=price_asc
```

**Example response**

```json
{
  "data": [
    {
      "id": 42,
      "sku": "SKU-AB12CD34",
      "slug": "classic-cotton-shirt",
      "name": "Classic Cotton Shirt",
      "short_description": "Soft breathable everyday shirt.",
      "price": 49.0,
      "sale_price": 39.0,
      "effective_price": 39.0,
      "on_sale": true,
      "in_stock": true,
      "stock": 25,
      "featured": false,
      "image": "https://yourdomain.com/storage/products/8f3a....webp",
      "category": {
        "id": 3,
        "name": "Shirts",
        "slug": "shirts"
      }
    }
  ],
  "links": {
    "first": "https://yourdomain.com/api/v1/products?page=1",
    "last": "https://yourdomain.com/api/v1/products?page=5",
    "prev": null,
    "next": "https://yourdomain.com/api/v1/products?page=2"
  },
  "meta": {
    "current_page": 1,
    "from": 1,
    "last_page": 5,
    "per_page": 12,
    "to": 12,
    "total": 58
  }
}
```

> Field notes: `effective_price` is `sale_price` when present, otherwise `price`.
> `on_sale` is `true` only when `sale_price` is set **and** lower than `price`.
> `in_stock` is `stock > 0`. `image` is a full URL or `null`. `category` is only present
> because the list eager-loads it.

### GET /products/{slug}

Returns a single active product by its unique `slug`. Returns `404` if not found or inactive.
The detail query also loads the product's `images` and `category`.

**Example request**

```
GET /api/v1/products/classic-cotton-shirt
```

**Example response**

```json
{
  "data": {
    "id": 42,
    "sku": "SKU-AB12CD34",
    "slug": "classic-cotton-shirt",
    "name": "Classic Cotton Shirt",
    "short_description": "Soft breathable everyday shirt.",
    "price": 49.0,
    "sale_price": 39.0,
    "effective_price": 39.0,
    "on_sale": true,
    "in_stock": true,
    "stock": 25,
    "featured": false,
    "image": "https://yourdomain.com/storage/products/8f3a....webp",
    "category": {
      "id": 3,
      "name": "Shirts",
      "slug": "shirts"
    }
  }
}
```

### GET /categories

Returns the category tree. Root categories are returned with their `children` nested, and a
`products_count` where it has been counted.

**Example request**

```
GET /api/v1/categories
```

**Example response**

```json
{
  "data": [
    {
      "id": 1,
      "name": "Clothing",
      "slug": "clothing",
      "image": "https://yourdomain.com/storage/categories/clothing.webp",
      "products_count": 12,
      "children": [
        {
          "id": 3,
          "name": "Shirts",
          "slug": "shirts",
          "image": null,
          "children": []
        }
      ]
    }
  ]
}
```

> Field notes: `image` is a full URL or `null`. `products_count` appears only when the
> relation count is loaded; `children` is an array of the same `CategoryResource` shape and
> may be empty.

## Resource shapes

The JSON shapes above map directly to `app/Http/Resources/ProductResource.php` and
`app/Http/Resources/CategoryResource.php`. Conditional fields (`category`, `products_count`,
`children`) are emitted via `whenLoaded()` / `whenCounted()`, so they appear only when the
controller loads the corresponding relation.

## Errors

| Status | Meaning |
|---|---|
| `404` | Product slug not found or product inactive |
| `422` | Validation issue on query parameters |
| `429` | Rate limit exceeded (60/min) |
| `500` | Server error |

The API is read-only: `POST`, `PUT`, `PATCH` and `DELETE` are not supported on v1 endpoints.
