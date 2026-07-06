// Thin typed client for the RAF Marketplace API.

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "https://raf-marketplace-api.onrender.com";

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

type ReqOpts = {
  method?: string;
  token?: string | null;
  body?: unknown;
  form?: Record<string, string>;
};

async function request<T>(path: string, opts: ReqOpts = {}): Promise<T> {
  const { method = "GET", token, body, form } = opts;
  const headers: Record<string, string> = {};
  let payload: string | undefined;

  if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    payload = new URLSearchParams(form).toString();
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: payload,
    cache: "no-store",
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const detail =
      (data && (data.detail || data.message)) || res.statusText || "Request failed";
    throw new ApiError(res.status, typeof detail === "string" ? detail : "Request failed", data);
  }
  return data as T;
}

// ---- types (subset of the API responses) ---------------------------------- //
export type Product = {
  product_id: number;
  vendor_id: number;
  name_ar: string;
  name_en: string;
  slug: string;
  base_price: string;
  rating_avg: string;
  rating_count: number;
  tags?: string[] | null;
};

export type Variant = {
  variant_id: number;
  sku: string;
  price: string;
  is_active: boolean;
};

export type ProductImage = { image_id: number; url: string; alt_text?: string | null };

export type ProductDetail = Product & {
  description_ar?: string | null;
  description_en?: string | null;
  variants: Variant[];
  images: ProductImage[];
};

export type ProductList = {
  total: number;
  page: number;
  page_size: number;
  items: Product[];
};

export type Tokens = { access_token: string; refresh_token: string; token_type: string };

export type CartItem = {
  variant_id: number;
  sku: string;
  name_ar: string;
  name_en: string;
  unit_price: string;
  quantity: number;
  line_total: string;
};
export type Cart = { cart_id: number; items: CartItem[]; subtotal: string };

export type ProductQuery = {
  q?: string;
  category_id?: number;
  brand_id?: number;
  min_price?: number;
  max_price?: number;
  in_stock?: boolean;
  sort?: "newest" | "price_asc" | "price_desc" | "rating";
  page?: number;
  page_size?: number;
};

export const api = {
  listProducts(query: ProductQuery = {}): Promise<ProductList> {
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") params[k] = String(v);
    }
    return request<ProductList>(`/products?${new URLSearchParams(params)}`);
  },
  getProduct(id: number | string): Promise<ProductDetail> {
    return request<ProductDetail>(`/products/${id}`);
  },
  login(email: string, password: string, totp?: string): Promise<Tokens> {
    const form: Record<string, string> = { username: email, password };
    if (totp) form.client_secret = totp;
    return request<Tokens>(`/auth/login`, { method: "POST", form });
  },
  register(payload: {
    full_name: string;
    email: string;
    password: string;
    phone?: string;
  }): Promise<unknown> {
    return request(`/auth/register`, { method: "POST", body: payload });
  },
  getCart(token: string): Promise<Cart> {
    return request<Cart>(`/cart`, { token });
  },
  addToCart(token: string, variant_id: number, quantity = 1): Promise<Cart> {
    return request<Cart>(`/cart/items`, { method: "POST", token, body: { variant_id, quantity } });
  },
  removeFromCart(token: string, variant_id: number): Promise<Cart> {
    return request<Cart>(`/cart/items/${variant_id}`, { method: "DELETE", token });
  },
  checkout(token: string, gateway = "cod", coupon_code?: string): Promise<any> {
    return request(`/orders/checkout`, {
      method: "POST",
      token,
      body: { gateway, ...(coupon_code ? { coupon_code } : {}) },
    });
  },
};
