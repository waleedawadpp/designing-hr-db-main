"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ProductDetail } from "@/lib/api";
import { formatOMR } from "@/lib/format";
import { useStore } from "@/lib/store";

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token, refreshCart } = useStore();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .getProduct(id)
      .then(setProduct)
      .catch((e) => setError(e?.message || "تعذّر تحميل المنتج"));
  }, [id]);

  async function addToCart(variantId: number) {
    if (!token) {
      router.push("/login?next=/products/" + id);
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await api.addToCart(token, variantId, 1);
      await refreshCart();
      setMsg("تمت الإضافة إلى السلة ✓");
    } catch (e: any) {
      setMsg(e?.message || "تعذّرت الإضافة");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>;
  if (!product) return <p className="py-10 text-center text-slate-400">جارٍ التحميل…</p>;

  const img = product.images?.[0]?.url;

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="flex h-80 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={product.name_ar} className="h-full w-full object-contain" />
        ) : (
          <span className="text-7xl text-slate-300">🛍️</span>
        )}
      </div>

      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{product.name_ar}</h1>
        <p className="text-slate-400">{product.name_en}</p>
        <div className="text-2xl font-bold text-brand">{formatOMR(product.base_price)}</div>
        {product.description_ar && <p className="text-slate-600">{product.description_ar}</p>}

        {product.tags && product.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {product.tags.map((t) => (
              <span key={t} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="space-y-2 pt-2">
          {product.variants.length === 0 && (
            <p className="text-sm text-slate-400">لا تتوفّر خيارات شراء حالياً.</p>
          )}
          {product.variants.map((v) => (
            <div
              key={v.variant_id}
              className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
            >
              <div>
                <div className="font-medium">{v.sku}</div>
                <div className="text-sm text-brand">{formatOMR(v.price)}</div>
              </div>
              <button
                disabled={busy || !v.is_active}
                onClick={() => addToCart(v.variant_id)}
                className="rounded-lg bg-brand px-4 py-2 font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
              >
                أضف للسلة
              </button>
            </div>
          ))}
        </div>

        {msg && <p className="text-sm font-medium text-brand">{msg}</p>}
      </div>
    </div>
  );
}
