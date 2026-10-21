"use client";
import { FileDown, Printer } from "lucide-react";

/** تصدير الجدول إلى Excel (من الخادم) و PDF (طباعة المتصفح بتنسيق A4 أفقي). */
export function ExportButtons({ table, params, printLabel = "PDF" }: { table: string; params?: Record<string, string>; printLabel?: string }) {
  const qs = new URLSearchParams({ table, ...(params ?? {}) }).toString();
  return (
    <>
      <a href={`/api/export?${qs}`} className="flex items-center gap-1 rounded bg-white/10 px-3 py-1.5 text-sm text-white ring-1 ring-gold hover:bg-white/20">
        <FileDown size={16} color="#C9A227" /> Excel
      </a>
      <button type="button" onClick={() => window.print()} className="flex items-center gap-1 rounded bg-white/10 px-3 py-1.5 text-sm text-white ring-1 ring-gold hover:bg-white/20">
        <Printer size={16} color="#C9A227" /> {printLabel}
      </button>
    </>
  );
}
