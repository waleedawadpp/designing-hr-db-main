"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, Cart } from "@/lib/api";
import { formatOMR } from "@/lib/format";
import { useStore } from "@/lib/store";

export default function CartPage() {
  const { token, refreshCart } = useStore();
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!token) return;
    try {
      setCart(await api.getCart(token));
    } catch (e: any) {
      setError(e?.message || "تعذّر تحميل السلة");
    }
  }

  useEffect(() => {
    if (token === null) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) {
    return (
      <div className="space-y-3 text-center">
        <p>سجّل الدخول لعرض سلتك.</p>
        <Link href="/login?next=/cart" className="font-semibold text-brand">
          تسجيل الدخول
        </Link>
      </div>
    );
  }

  async function remove(variantId: number) {
    if (!token) return;
    await api.removeFromCart(token, variantId);
    await load();
    await refreshCart();
  }

  async function checkout() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const o = await api.checkout(token, "cod");
      setOrder(o);
      await load();
      await refreshCart();
    } catch (e: any) {
      setError(e?.message || "تعذّر إتمام الطلب");
    } finally {
      setBusy(false);
    }
  }

  if (order) {
    return (
      <div className="mx-auto max-w-md space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <div className="text-4xl">✅</div>
        <h1 className="text-xl font-bold">تم إنشاء طلبك</h1>
        <p>
          رقم الطلب: <span className="font-mono font-bold">{order.order_number}</span>
        </p>
        <p>الإجمالي: {formatOMR(order.grand_total)}</p>
        <p className="text-sm text-slate-500">طريقة الدفع: الدفع عند الاستلام</p>
        <Link href="/" className="inline-block font-semibold text-brand">
          متابعة التسوّق
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">السلة</h1>
      {error && <p className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
      {!cart ? (
        <p className="py-10 text-center text-slate-400">جارٍ التحميل…</p>
      ) : cart.items.length === 0 ? (
        <p className="py-10 text-center text-slate-400">سلتك فارغة.</p>
      ) : (
        <>
          <div className="space-y-2">
            {cart.items.map((it) => (
              <div
                key={it.variant_id}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3"
              >
                <div>
                  <div className="font-medium">{it.name_ar}</div>
                  <div className="text-sm text-slate-400">
                    {it.sku} · ×{it.quantity}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-brand">{formatOMR(it.line_total)}</span>
                  <button
                    onClick={() => remove(it.variant_id)}
                    className="text-sm text-red-500 hover:underline"
                  >
                    حذف
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 pt-4">
            <span className="text-lg font-bold">الإجمالي</span>
            <span className="text-lg font-bold text-brand">{formatOMR(cart.subtotal)}</span>
          </div>

          <button
            disabled={busy}
            onClick={checkout}
            className="w-full rounded-lg bg-brand py-3 font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            إتمام الطلب (الدفع عند الاستلام)
          </button>
        </>
      )}
    </div>
  );
}
