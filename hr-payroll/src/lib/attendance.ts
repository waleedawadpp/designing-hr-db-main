// تسجيل رموز الحضور على تواريخ بعينها، لأي شهر (ماضٍ أو قادم):
// يُنشئ سطر الشهر للموظف عند الحاجة، ويحترم الأشهر المعتمدة ومدة خدمة الموظف.
// تستخدمه: الإدخال بفترة تاريخ، والتسجيل اليومي، وصفحة الموظف.
import "server-only";
import { prisma } from "./db";
import { audit } from "./audit";
import { isValidDate, isWorkingInMonth, MIN_DATE, monthBounds, nextMonthKey, weekdayOf, type AttendanceCode } from "./payroll";
import { closedMonths } from "./month-close";
import { getSettings } from "./report";
import { currentMonthKey } from "./utils";

type User = { email: string };
type Emp = { id: string; name: string; hireDate: string | null; endDate: string | null };

/** أقدم شهر يمكن إدخاله، وأبعد شهر (سنة بعد الشهر الحالي). */
export const MIN_MONTH = MIN_DATE.slice(0, 7);
export function maxMonth(): string {
  let m = currentMonthKey();
  for (let i = 0; i < 12; i++) m = nextMonthKey(m);
  return m;
}
export function isAllowedMonth(ym: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(ym) && ym >= MIN_MONTH && ym <= maxMonth();
}

export function inService(e: Pick<Emp, "hireDate" | "endDate">, date: string): boolean {
  return (!e.hireDate || e.hireDate <= date) && (!e.endDate || e.endDate >= date);
}

/** كل التواريخ من from إلى to (شاملة). */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** يكتب رمز يوم واحد ويسجّله في التدقيق. يُرجع true إن تغيّر. */
export async function setCode(monthId: string, day: number, code: string | null, user: User): Promise<boolean> {
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

/** سطر الشهر الأول للموظف؛ يُنشأ إن لم يوجد. */
export async function ensureMonthRow(emp: Pick<Emp, "id" | "name">, month: string, user: User) {
  const row = await prisma.attendanceMonth.findFirst({ where: { employeeId: emp.id, month, deletedAt: null }, orderBy: { dupSeq: "asc" } });
  if (row) return row;
  // dupSeq فريد مع الأسطر المحذوفة أيضًا
  const last = await prisma.attendanceMonth.findFirst({ where: { employeeId: emp.id, month }, orderBy: { dupSeq: "desc" } });
  const created = await prisma.attendanceMonth.create({ data: { employeeId: emp.id, month, dupSeq: last ? last.dupSeq + 1 : 0 } });
  await audit(user, "create", "AttendanceMonth", created.id, `إضافة سطر ${emp.name} لشهر ${month}`);
  return created;
}

/** يُنشئ أسطر الشهر لكل من يعمل فيه وليس له سطر. */
export async function createMonthRows(month: string, user: User, employeeIds?: string[]): Promise<number> {
  const employees = await prisma.employee.findMany({
    where: employeeIds ? { id: { in: employeeIds } } : undefined,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const existing = new Set(
    (await prisma.attendanceMonth.findMany({ where: { month, deletedAt: null }, select: { employeeId: true } })).map((r) => r.employeeId),
  );
  let created = 0;
  for (const e of employees) {
    if (!isWorkingInMonth(e, month) || existing.has(e.id)) continue;
    await ensureMonthRow(e, month, user);
    created++;
  }
  return created;
}

/** من يعمل في الشهر وليس له سطر فيه. */
export async function missingInMonth(month: string): Promise<{ id: string; code: string; name: string }[]> {
  const employees = await prisma.employee.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const existing = new Set(
    (await prisma.attendanceMonth.findMany({ where: { month, deletedAt: null }, select: { employeeId: true } })).map((r) => r.employeeId),
  );
  return employees.filter((e) => isWorkingInMonth(e, month) && !existing.has(e.id)).map((e) => ({ id: e.id, code: e.code, name: e.name }));
}

export interface SetCodesResult {
  changed: number;
  unchanged: number;
  skipped: { closed: number; outOfService: number; offDay: number; existing: number };
}

/**
 * يسجّل الرمز (أو يمسحه عند null) على التواريخ المعطاة لموظف واحد.
 * overwrite = false: لا يغيّر الخانات التي فيها رمز. skipOffDay: يتخطى يوم العطلة الأسبوعية.
 */
export async function setCodesForDates(
  user: User,
  emp: Emp,
  dates: string[],
  code: AttendanceCode | null,
  opts: { overwrite: boolean; skipOffDay: boolean },
): Promise<SetCodesResult> {
  const settings = await getSettings(prisma);
  const closed = new Set(await closedMonths(prisma));
  const res: SetCodesResult = { changed: 0, unchanged: 0, skipped: { closed: 0, outOfService: 0, offDay: 0, existing: 0 } };

  const byMonth = new Map<string, string[]>();
  for (const d of dates) {
    if (!isValidDate(d)) continue;
    const m = d.slice(0, 7);
    byMonth.set(m, [...(byMonth.get(m) ?? []), d]);
  }

  for (const [month, list] of byMonth) {
    if (closed.has(month)) {
      res.skipped.closed += list.length;
      continue;
    }
    const todo: number[] = [];
    for (const d of list) {
      if (!inService(emp, d)) res.skipped.outOfService++;
      else if (opts.skipOffDay && weekdayOf(d) === settings.weeklyOffDay) res.skipped.offDay++;
      else todo.push(Number(d.slice(8, 10)));
    }
    if (!todo.length) continue;
    // المسح لا يحتاج إنشاء سطر جديد
    const row = code === null
      ? await prisma.attendanceMonth.findFirst({ where: { employeeId: emp.id, month, deletedAt: null }, orderBy: { dupSeq: "asc" } })
      : await ensureMonthRow(emp, month, user);
    if (!row) {
      res.unchanged += todo.length;
      continue;
    }
    const current = new Map((await prisma.attendanceDay.findMany({ where: { monthId: row.id } })).map((d) => [d.day, d.code]));
    const { days } = monthBounds(month);
    for (const day of todo) {
      if (day > days) continue;
      const cur = current.get(day) ?? null;
      if (cur === code) res.unchanged++;
      else if (cur && !opts.overwrite) res.skipped.existing++;
      else if (await setCode(row.id, day, code, user)) res.changed++;
    }
  }
  return res;
}

/** نص عربي مختصر لنتيجة التسجيل. */
export function describeResult(r: SetCodesResult): string {
  const parts = [`تم تسجيل ${r.changed} يوم`];
  if (r.unchanged) parts.push(`${r.unchanged} بلا تغيير`);
  if (r.skipped.offDay) parts.push(`تُخطّي ${r.skipped.offDay} يوم عطلة`);
  if (r.skipped.existing) parts.push(`${r.skipped.existing} فيها رمز آخر لم يُستبدل`);
  if (r.skipped.outOfService) parts.push(`${r.skipped.outOfService} خارج مدة الخدمة`);
  if (r.skipped.closed) parts.push(`${r.skipped.closed} في أشهر معتمدة ومقفلة`);
  return parts.join(" • ");
}
