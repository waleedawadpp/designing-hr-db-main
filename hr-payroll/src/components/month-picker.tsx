"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MONTHS, YEARS } from "@/lib/utils";

/** اختيار السنة والشهر — يحدّث ?y=&m= في الرابط. */
export function MonthPicker({ ym, extra }: { ym: string; extra?: Record<string, string | undefined> }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [y, m] = ym.split("-").map(Number);

  function go(ny: number, nm: number) {
    const p = new URLSearchParams(sp.toString());
    p.set("y", String(ny));
    p.set("m", String(nm));
    p.delete("page");
    for (const [k, v] of Object.entries(extra ?? {})) (v == null ? p.delete(k) : p.set(k, v));
    router.push(`${path}?${p.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-semibold">السنة</label>
      <select aria-label="السنة" className="select-cream" value={y} onChange={(e) => go(Number(e.target.value), m)}>
        {YEARS.map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
      <label className="text-sm font-semibold">الشهر</label>
      <select aria-label="الشهر" className="select-cream" value={m} onChange={(e) => go(y, Number(e.target.value))}>
        {MONTHS.map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
    </div>
  );
}
