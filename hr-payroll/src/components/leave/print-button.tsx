"use client";
import { Printer } from "lucide-react";

export function PrintButton({ label = "طباعة" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="flex items-center gap-1 rounded bg-white/10 px-3 py-1.5 text-sm text-white ring-1 ring-gold hover:bg-white/20">
      <Printer size={16} color="#C9A227" /> {label}
    </button>
  );
}
