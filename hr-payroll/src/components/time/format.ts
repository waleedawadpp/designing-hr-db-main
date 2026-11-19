/** 545 ← "9:05" (ساعات:دقائق)؛ الصفر ← فارغ */
export function fmtMinutes(min: number | null | undefined): string {
  if (!min) return "";
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
}
