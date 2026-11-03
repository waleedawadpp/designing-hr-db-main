// اعتماد الشهر (قفله): يمنع أي تعديل على بيانات شهر صُرفت رواتبه حتى يعيد المدير فتحه.
import type { PrismaClient } from "@prisma/client";
import { formatMonth } from "./payroll";

export class MonthClosedError extends Error {}

export async function closedMonths(db: PrismaClient): Promise<string[]> {
  return (await db.monthClose.findMany({ select: { month: true } })).map((m) => m.month);
}

/** يرمي خطأ إن كان أيّ من الأشهر (YYYY-MM) أو أشهر التواريخ (YYYY-MM-DD) معتمدًا. */
export async function assertMonthsOpen(db: PrismaClient, ...monthsOrDates: (string | null | undefined)[]) {
  const months = [...new Set(monthsOrDates.filter((v): v is string => !!v).map((v) => v.slice(0, 7)))];
  if (!months.length) return;
  const hit = await db.monthClose.findFirst({ where: { month: { in: months } } });
  if (hit) throw new MonthClosedError(`شهر ${formatMonth(hit.month)} معتمد ومقفل — أعد فتحه من «الكشف الشهري» قبل التعديل`);
}
