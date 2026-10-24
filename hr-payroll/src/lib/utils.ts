import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const YEARS = Array.from({ length: 2060 - 2024 + 1 }, (_, i) => 2024 + i);
export const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export function todayISO(): string {
  const d = new Date();
  // توقيت مسقط (UTC+4)
  const t = new Date(d.getTime() + 4 * 3600_000);
  return t.toISOString().slice(0, 10);
}

export function currentMonthKey(): string {
  return todayISO().slice(0, 7);
}

/** قراءة ?y=&m= من الرابط، مع الافتراضي = الشهر الحالي. */
export function monthFromParams(sp: { y?: string; m?: string }, fallback = currentMonthKey()): string {
  const y = Number(sp.y);
  const m = Number(sp.m);
  if (y >= 2020 && y <= 2100 && m >= 1 && m <= 12) return `${y}-${String(m).padStart(2, "0")}`;
  return fallback;
}
