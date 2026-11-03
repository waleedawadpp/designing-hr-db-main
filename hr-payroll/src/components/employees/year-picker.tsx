"use client";
import { usePathname, useRouter } from "next/navigation";

export function YearPicker({ years, year }: { years: number[]; year: number }) {
  const router = useRouter();
  const path = usePathname();
  return (
    <label className="flex items-center gap-2 text-sm font-semibold">
      السنة
      <select aria-label="السنة" className="select-cream" value={year} onChange={(e) => router.push(`${path}?year=${e.target.value}`)}>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </label>
  );
}
