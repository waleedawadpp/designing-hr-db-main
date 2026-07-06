import Link from "next/link";
import { Product } from "@/lib/api";
import { formatOMR } from "@/lib/format";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/products/${product.product_id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
    >
      <div className="flex h-40 items-center justify-center bg-slate-100 text-4xl text-slate-300">
        {/* Placeholder; product images are shown on the detail page */}
        🛍️
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-1 font-semibold group-hover:text-brand">{product.name_ar}</h3>
        <p className="line-clamp-1 text-xs text-slate-400">{product.name_en}</p>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-bold text-brand">{formatOMR(product.base_price)}</span>
          {product.rating_count > 0 && (
            <span className="text-xs text-amber-500">★ {Number(product.rating_avg).toFixed(1)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
