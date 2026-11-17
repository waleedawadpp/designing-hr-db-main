"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { MonthClosedError } from "@/lib/month-close";
import { saveTime, TimeInputError, TIME_SOURCE_MANUAL } from "@/lib/time-sync";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** حفظ وقت دخول/خروج يوم يدويًا (يحدّث الإضافي التلقائي وخانة الحضور). */
export async function saveDayTime(employeeId: string, date: string, checkIn: string, checkOut: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireAdmin();
  if (!DATE.test(date)) return { ok: false, error: "تاريخ غير صحيح" };
  try {
    await saveTime(user, { employeeId, date, checkIn, checkOut, source: TIME_SOURCE_MANUAL });
  } catch (e) {
    if (e instanceof TimeInputError || e instanceof MonthClosedError) return { ok: false, error: e.message };
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
