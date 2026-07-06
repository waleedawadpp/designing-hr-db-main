"use client";

import { useEffect, useState } from "react";
import { api, Product, ProductQuery } from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";

const SORTS: { value: ProductQuery["sort"]; label: string }[] = [
  { value: "newest", label: "الأحدث" },
  { value: "price_asc", label: "الأرخص" },
  { value: "price_desc", label: "الأغلى" },
  { value: "rating", label: "الأعلى تقييماً" },
];

export default function HomePage() {
  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<ProductQuery["sort"]>("newest");
  const [inStock, setInStock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listProducts({ q, sort, in_stock: inStock, page_size: 24 });
      setItems(res.items);
      setTotal(res.total);
    } catch (e: any) {
      setError(e?.message || "تعذّر تحميل المنتجات");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, inStock]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-l from-brand to-brand-dark p-8 text-white">
        <h1 className="text-3xl font-bold">سوق RAF</h1>
        <p className="mt-2 text-white/90">تسوّق آلاف المنتجات من بائعين موثوقين في عُمان والخليج.</p>
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
        className="flex flex-wrap items-center gap-3"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث عن منتج…"
          className="flex-1 rounded-lg border border-slate-300 px-4 py-2 focus:border-brand focus:outline-none"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as ProductQuery["sort"])}
          className="rounded-lg border border-slate-300 px-3 py-2"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} />
          المتوفّر فقط
        </label>
        <button className="rounded-lg bg-brand px-5 py-2 font-semibold text-white hover:bg-brand-dark">
          بحث
        </button>
      </form>

      {error && <p className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}

      {loading ? (
        <p className="py-10 text-center text-slate-400">جارٍ التحميل…</p>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-slate-400">لا توجد منتجات مطابقة.</p>
      ) : (
        <>
          <p className="text-sm text-slate-500">{total} منتج</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {items.map((p) => (
              <ProductCard key={p.product_id} product={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
