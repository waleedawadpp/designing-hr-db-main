"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { INVALID_CODE_MESSAGE, formatMonth, isValidCode, isValidDate, monthBounds, nextMonthKey, pad2, weekdayOf, activeDays } from "@/lib/payroll";
import { createMonthRows, datesBetween, describeResult, inService, isAllowedMonth, missingInMonth, setCode, setCodesForDates, MIN_MONTH } from "@/lib/attendance";
import { getSettings } from "@/lib/report";
import { assertMonthsOpen, MonthClosedError } from "@/lib/month-close";
import { currentMonthKey } from "@/lib/utils";

type Result = { ok: true } | { ok: false; error: string };

/** رسالة الخطأ إن كان الشهر معتمدًا، وإلا null. */
async function closedError(...months: (string | null | undefined)[]): Promise<string | null> {
  try {
    await assertMonthsOpen(prisma, ...months);
    return null;
  } catch (e) {
    if (e instanceof MonthClosedError) return e.message;
    throw e;
  }
}

export async function setDayCode(monthId: string, day: number, code: string | null): Promise<Result> {
  const user = await requireAdmin();
  if (code !== null && !isValidCode(code)) return { ok: false, error: INVALID_CODE_MESSAGE };
  const row = await prisma.attendanceMonth.findUnique({ where: { id: monthId } });
  if (!row || row.deletedAt) return { ok: false, error: "السطر غير موجود" };
  const locked = await closedError(row.month);
  if (locked) return { ok: false, error: locked };
  const { days } = monthBounds(row.month);
  if (!Number.isInteger(day) || day < 1 || day > days) return { ok: false, error: "هذا اليوم خارج الشهر" };
  await setCode(monthId, day, code, user);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setMonthNotes(monthId: string, notes: string): Promise<Result> {
  const user = await requireAdmin();
  const before = await prisma.attendanceMonth.findUnique({ where: { id: monthId } });
  if (!before) return { ok: false, error: "السطر غير موجود" };
  const locked = await closedError(before.month);
  if (locked) return { ok: false, error: locked };
  const value = notes.trim() || null;
  if (before.notes === value) return { ok: true };
  await prisma.attendanceMonth.update({ where: { id: monthId }, data: { notes: value } });
  await audit(user, "update", "AttendanceMonth", monthId, "ملاحظات سطر الحضور", before.notes, value);
  return { ok: true };
}

/** أكبر شهر موجود + 1 (أو الشهر الحالي إن لم توجد أشهر). */
export async function getNextMonth(): Promise<string> {
  const last = await prisma.attendanceMonth.findFirst({ where: { deletedAt: null }, orderBy: { month: "desc" } });
  return last ? nextMonthKey(last.month) : currentMonthKey();
}

/** من سيُنشأ له سطر في الشهر (يعمل فيه وليس له سطر). */
export async function previewMonth(month: string): Promise<{ ok: true; missing: { id: string; code: string; name: string }[] } | { ok: false; error: string }> {
  await requireAdmin();
  if (!isAllowedMonth(month)) return { ok: false, error: `اختر شهرًا من ${formatMonth(MIN_MONTH)} حتى سنة من الآن` };
  return { ok: true, missing: await missingInMonth(month) };
}

/** يُنشئ أسطر أي شهر (ماضٍ أو قادم) لمن يعمل فيه وليس له سطر — أو للموظفين المحددين فقط. */
export async function addMonth(month: string, employeeIds?: string[]): Promise<{ ok: true; month: string; created: number } | { ok: false; error: string }> {
  const user = await requireAdmin();
  if (!isAllowedMonth(month)) return { ok: false, error: `اختر شهرًا من ${formatMonth(MIN_MONTH)} حتى سنة من الآن` };
  const locked = await closedError(month);
  if (locked) return { ok: false, error: locked };
  const created = await createMonthRows(month, user, employeeIds);
  revalidatePath("/", "layout");
  return { ok: true, month, created };
}

export async function addNextMonth() {
  return addMonth(await getNextMonth());
}

/** تسجيل رمز لموظف على فترة من تاريخ إلى تاريخ (مثل: إجازة من 05/03 إلى 20/03). */
export async function recordRange(input: {
  employeeId: string;
  from: string | null;
  to: string | null;
  code: string | null;
  overwrite: boolean;
  skipOffDay: boolean;
}): Promise<{ ok: true; message: string; changed: number } | { ok: false; error: string }> {
  const user = await requireAdmin();
  const emp = await prisma.employee.findUnique({ where: { id: input.employeeId } });
  if (!emp) return { ok: false, error: "اختر الموظف" };
  if (!input.from || !isValidDate(input.from)) return { ok: false, error: "تاريخ البداية غير صحيح" };
  const to = input.to || input.from;
  if (!isValidDate(to)) return { ok: false, error: "تاريخ النهاية غير صحيح" };
  if (to < input.from) return { ok: false, error: "تاريخ النهاية قبل تاريخ البداية" };
  if (input.code !== null && !isValidCode(input.code)) return { ok: false, error: INVALID_CODE_MESSAGE };
  const dates = datesBetween(input.from, to);
  if (dates.length > 366) return { ok: false, error: "الفترة أطول من سنة" };
  const r = await setCodesForDates(user, emp, dates, input.code, { overwrite: input.overwrite, skipOffDay: input.skipOffDay });
  revalidatePath("/", "layout");
  return { ok: true, message: `${emp.name}: ${describeResult(r)}`, changed: r.changed };
}

/** التسجيل اليومي: رمز موظف واحد في تاريخ واحد. */
export async function setCodeOnDate(employeeId: string, date: string, code: string | null): Promise<Result> {
  const user = await requireAdmin();
  if (!isValidDate(date)) return { ok: false, error: "تاريخ غير صحيح" };
  if (code !== null && !isValidCode(code)) return { ok: false, error: INVALID_CODE_MESSAGE };
  const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!emp) return { ok: false, error: "الموظف غير موجود" };
  const locked = await closedError(date);
  if (locked) return { ok: false, error: locked };
  if (!inService(emp, date)) return { ok: false, error: "التاريخ خارج مدة خدمة الموظف" };
  await setCodesForDates(user, emp, [date], code, { overwrite: true, skipOffDay: false });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** التسجيل اليومي: «ح» لكل من على رأس العمل في التاريخ وخانته فارغة. */
export async function fillPresentOnDate(date: string): Promise<Result & { changed?: number }> {
  const user = await requireAdmin();
  if (!isValidDate(date)) return { ok: false, error: "تاريخ غير صحيح" };
  const locked = await closedError(date);
  if (locked) return { ok: false, error: locked };
  const employees = await prisma.employee.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  let changed = 0;
  for (const e of employees) {
    if (!inService(e, date)) continue;
    const r = await setCodesForDates(user, e, [date], "ح", { overwrite: false, skipOffDay: false });
    changed += r.changed;
  }
  revalidatePath("/", "layout");
  return { ok: true, changed };
}

/** تعبئة "ح" لكل الأسطر في يوم محدد (الخانات الفارغة فقط، وضمن مدة خدمة الموظف). */
export async function fillDayPresent(month: string, day: number): Promise<Result & { changed?: number }> {
  const user = await requireAdmin();
  const locked = await closedError(month);
  if (locked) return { ok: false, error: locked };
  const { days } = monthBounds(month);
  if (day < 1 || day > days) return { ok: false, error: "هذا اليوم خارج الشهر" };
  const date = `${month}-${pad2(day)}`;
  const rows = await prisma.attendanceMonth.findMany({ where: { month, deletedAt: null }, include: { employee: true, days: { where: { day } } } });
  let changed = 0;
  for (const r of rows) {
    if (!inService(r.employee, date)) continue;
    if (r.days[0]?.code) continue;
    if (await setCode(r.id, day, "ح", user)) changed++;
  }
  revalidatePath("/", "layout");
  return { ok: true, changed };
}

/** تعبئة "ح" للموظف في كل أيام العمل (بدون يوم العطلة) — الخانات الفارغة فقط. */
export async function fillEmployeePresent(monthId: string): Promise<Result & { changed?: number }> {
  const user = await requireAdmin();
  const r = await prisma.attendanceMonth.findUnique({ where: { id: monthId }, include: { employee: true, days: true } });
  if (!r) return { ok: false, error: "السطر غير موجود" };
  const locked = await closedError(r.month);
  if (locked) return { ok: false, error: locked };
  const settings = await getSettings(prisma);
  const { days } = monthBounds(r.month);
  if (activeDays(r.employee, r.month) === 0) return { ok: true, changed: 0 };
  const filled = new Map(r.days.map((d) => [d.day, d.code]));
  let changed = 0;
  for (let d = 1; d <= days; d++) {
    const date = `${r.month}-${pad2(d)}`;
    if (weekdayOf(date) === settings.weeklyOffDay || !inService(r.employee, date) || filled.get(d)) continue;
    if (await setCode(r.id, d, "ح", user)) changed++;
  }
  revalidatePath("/", "layout");
  return { ok: true, changed };
}
