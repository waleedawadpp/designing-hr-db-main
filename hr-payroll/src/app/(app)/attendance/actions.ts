"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { INVALID_CODE_MESSAGE, isValidCode, isWorkingInMonth, monthBounds, nextMonthKey, pad2, weekdayOf, activeDays } from "@/lib/payroll";
import { getSettings } from "@/lib/report";
import { currentMonthKey } from "@/lib/utils";

type Result = { ok: true } | { ok: false; error: string };

async function setCode(monthId: string, day: number, code: string | null, user: { email: string }) {
  const existing = await prisma.attendanceDay.findUnique({ where: { monthId_day: { monthId, day } } });
  if ((existing?.code ?? null) === code) return false;
  await prisma.attendanceDay.upsert({
    where: { monthId_day: { monthId, day } },
    update: { code },
    create: { monthId, day, code },
  });
  await audit(user, "update", "AttendanceDay", `${monthId}:${day}`, `يوم ${day}: ${existing?.code ?? "فارغ"} ← ${code ?? "فارغ"}`, existing?.code ?? null, code);
  return true;
}

export async function setDayCode(monthId: string, day: number, code: string | null): Promise<Result> {
  const user = await requireAdmin();
  if (code !== null && !isValidCode(code)) return { ok: false, error: INVALID_CODE_MESSAGE };
  const row = await prisma.attendanceMonth.findUnique({ where: { id: monthId } });
  if (!row || row.deletedAt) return { ok: false, error: "السطر غير موجود" };
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

export async function addNextMonth(): Promise<{ ok: true; month: string; created: number } | { ok: false; error: string }> {
  const user = await requireAdmin();
  const month = await getNextMonth();
  const employees = await prisma.employee.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const existing = new Set(
    (await prisma.attendanceMonth.findMany({ where: { month, deletedAt: null }, select: { employeeId: true } })).map((r) => r.employeeId),
  );
  let created = 0;
  for (const e of employees) {
    if (!isWorkingInMonth(e, month) || existing.has(e.id)) continue;
    const r = await prisma.attendanceMonth.create({ data: { employeeId: e.id, month } });
    await audit(user, "create", "AttendanceMonth", r.id, `إضافة سطر ${e.name} لشهر ${month}`);
    created++;
  }
  revalidatePath("/", "layout");
  return { ok: true, month, created };
}

function inActiveRange(e: { hireDate: string | null; endDate: string | null }, date: string) {
  return (!e.hireDate || e.hireDate <= date) && (!e.endDate || e.endDate >= date);
}

/** تعبئة "ح" لكل الأسطر في يوم محدد (الخانات الفارغة فقط، وضمن مدة خدمة الموظف). */
export async function fillDayPresent(month: string, day: number): Promise<Result & { changed?: number }> {
  const user = await requireAdmin();
  const { days } = monthBounds(month);
  if (day < 1 || day > days) return { ok: false, error: "هذا اليوم خارج الشهر" };
  const date = `${month}-${pad2(day)}`;
  const rows = await prisma.attendanceMonth.findMany({ where: { month, deletedAt: null }, include: { employee: true, days: { where: { day } } } });
  let changed = 0;
  for (const r of rows) {
    if (!inActiveRange(r.employee, date)) continue;
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
  const settings = await getSettings(prisma);
  const { days } = monthBounds(r.month);
  if (activeDays(r.employee, r.month) === 0) return { ok: true, changed: 0 };
  const filled = new Map(r.days.map((d) => [d.day, d.code]));
  let changed = 0;
  for (let d = 1; d <= days; d++) {
    const date = `${r.month}-${pad2(d)}`;
    if (weekdayOf(date) === settings.weeklyOffDay || !inActiveRange(r.employee, date) || filled.get(d)) continue;
    if (await setCode(r.id, d, "ح", user)) changed++;
  }
  revalidatePath("/", "layout");
  return { ok: true, changed };
}
