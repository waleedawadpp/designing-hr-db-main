"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { assertMonthsOpen, MonthClosedError } from "@/lib/month-close";
import { resyncOpenTimes } from "@/lib/time-sync";
import { HOLIDAY_RATES, OVERTIME_RATES, isValidDate } from "@/lib/payroll";

export interface SettingsState {
  ok?: boolean;
  error?: string;
  message?: string;
}

export async function saveSettings(_: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await requireAdmin();
  const annualLeaveEntitlement = Number(form.get("annualLeaveEntitlement"));
  const weeklyOffDay = Number(form.get("weeklyOffDay"));
  const systemStartYear = Number(form.get("systemStartYear"));
  const standardHours = Number(form.get("standardHours"));
  const overtimeRate = Number(form.get("overtimeRate"));
  const holidayRate = Number(form.get("holidayRate"));
  const shortDeduction = form.get("shortDeduction") !== "0";
  const graceMinutes = Number(form.get("graceMinutes") ?? 15);
  const payByAttendanceFrom = String(form.get("payByAttendanceFrom") ?? "").trim() || null;
  if (!Number.isInteger(annualLeaveEntitlement) || annualLeaveEntitlement < 0 || annualLeaveEntitlement > 365) return { error: "رصيد الإجازة بين 0 و 365 يومًا" };
  if (!Number.isInteger(weeklyOffDay) || weeklyOffDay < 0 || weeklyOffDay > 6) return { error: "يوم العطلة غير صحيح" };
  if (!Number.isInteger(systemStartYear) || systemStartYear < 2020 || systemStartYear > 2100) return { error: "سنة بداية النظام بين 2020 و 2100" };
  if (!Number.isFinite(standardHours) || standardHours < 1 || standardHours > 16 || Math.round(standardHours * 4) !== standardHours * 4)
    return { error: "ساعات الدوام الرسمية بين 1 و 16 (بأرباع الساعة، مثل 8.5)" };
  if (!(OVERTIME_RATES as readonly number[]).includes(overtimeRate)) return { error: "معدل الإضافي: 1.25 أو 1.5" };
  if (!(HOLIDAY_RATES as readonly number[]).includes(holidayRate)) return { error: "معدل العطلات: 1.25 أو 1.5 أو 2" };
  if (!Number.isInteger(graceMinutes) || graceMinutes < 0 || graceMinutes > 120) return { error: "مهلة السماح بين 0 و 120 دقيقة" };
  if (payByAttendanceFrom && !/^20\d\d-(0[1-9]|1[0-2])$/.test(payByAttendanceFrom)) return { error: "شهر بداية حساب الراتب غير صحيح" };
  const before = await prisma.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  const data = { annualLeaveEntitlement, weeklyOffDay, systemStartYear, standardHours, overtimeRate, holidayRate, shortDeduction, graceMinutes, payByAttendanceFrom };
  await prisma.settings.update({ where: { id: 1 }, data });
  await audit(user, "update", "Settings", "1", "تعديل الإعدادات", before, data);
  // ساعات الدوام ويوم العطلة وإعدادات الخصم تغيّر الإضافي والخصم المحسوبين من الأوقات (الأشهر غير المعتمدة فقط)
  let message: string | undefined;
  if (
    before.standardHours !== standardHours ||
    before.weeklyOffDay !== weeklyOffDay ||
    before.shortDeduction !== shortDeduction ||
    before.graceMinutes !== graceMinutes
  ) {
    const n = await resyncOpenTimes(user);
    if (n) message = `أُعيد حساب الإضافي والخصم في ${n} يومًا من أيام الدوام`;
  }
  revalidatePath("/", "layout");
  return { ok: true, message };
}

/** إضافة إجازة رسمية (أو تعديل اسمها). */
export async function addHoliday(_: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await requireAdmin();
  const date = String(form.get("date") ?? "");
  const name = String(form.get("name") ?? "").trim();
  if (!isValidDate(date)) return { error: "تاريخ غير صحيح" };
  if (!name) return { error: "اكتب اسم الإجازة" };
  try {
    await assertMonthsOpen(prisma, date);
  } catch (e) {
    if (e instanceof MonthClosedError) return { error: e.message };
    throw e;
  }
  const before = await prisma.holiday.findUnique({ where: { date } });
  await prisma.holiday.upsert({ where: { date }, update: { name }, create: { date, name } });
  await audit(user, before ? "update" : "create", "Holiday", date, `إجازة رسمية ${date}: ${name}`, before ?? undefined, { date, name });
  await resyncOpenTimes(user, { date });
  revalidatePath("/", "layout");
  return { ok: true, message: `✔ أُضيفت ${name}` };
}

export async function removeHoliday(date: string): Promise<SettingsState> {
  const user = await requireAdmin();
  const before = await prisma.holiday.findUnique({ where: { date } });
  if (!before) return { error: "الإجازة غير موجودة" };
  try {
    await assertMonthsOpen(prisma, date);
  } catch (e) {
    if (e instanceof MonthClosedError) return { error: e.message };
    throw e;
  }
  await prisma.holiday.delete({ where: { date } });
  await audit(user, "delete", "Holiday", date, `حذف الإجازة الرسمية ${date}: ${before.name}`, before);
  await resyncOpenTimes(user, { date });
  revalidatePath("/", "layout");
  return { ok: true };
}
