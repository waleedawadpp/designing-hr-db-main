"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { setAttendanceCode } from "@/lib/attendance-write";
import { readSheetRows, NotXlsxError } from "@/lib/biometric-xlsx";
import { BiometricFormatError, datesBetween, parsePunchLog, type PunchLog } from "@/lib/biometric";
import { INVALID_CODE_MESSAGE, isValidCode, isWorkingInMonth } from "@/lib/payroll";
import { getHolidays, getSettings } from "@/lib/report";
import { saveTime, TimeInputError, TIME_SOURCE_DEVICE } from "@/lib/time-sync";
import { closedMonths } from "@/lib/month-close";

export interface BioEmployee {
  id: string;
  code: string;
  name: string;
  hireDate: string | null;
  endDate: string | null;
  deviceId: string | null;
}

export interface LoadState {
  error?: string;
  fileName?: string;
  log?: PunchLog;
  employees?: BioEmployee[];
  /** معرّف الموظف ← التاريخ ← الرمز الحالي */
  current?: Record<string, Record<string, string>>;
  weeklyOffDay?: number;
  closed?: string[];
  /** الإجازات الرسمية في فترة التقرير */
  holidays?: string[];
}

const MAX_BYTES = 10 * 1024 * 1024;

/** يقرأ سجل الحركات ويعيد كل ما تحتاجه المعاينة (لا يحفظ شيئًا). */
export async function loadPunchLog(_prev: LoadState, form: FormData): Promise<LoadState> {
  await requireAdmin();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "اختر ملف تقرير البصمة" };
  if (file.size > MAX_BYTES) return { error: "حجم الملف أكبر من 10 ميغابايت" };
  let log: PunchLog;
  try {
    log = parsePunchLog(await readSheetRows(new Uint8Array(await file.arrayBuffer())));
  } catch (e) {
    if (e instanceof BiometricFormatError || e instanceof NotXlsxError) return { error: e.message };
    return { error: "تعذّرت قراءة الملف — تأكد أنه تقرير Excel من برنامج البصمة" };
  }
  const months = [...new Set(datesBetween(log.start, log.end).map((d) => d.slice(0, 7)))];
  const [employees, rows, settings, closed] = await Promise.all([
    prisma.employee.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, code: true, name: true, hireDate: true, endDate: true, deviceId: true },
    }),
    prisma.attendanceMonth.findMany({ where: { month: { in: months }, deletedAt: null, dupSeq: 0 }, include: { days: true } }),
    getSettings(prisma),
    closedMonths(prisma),
  ]);
  const current: Record<string, Record<string, string>> = {};
  for (const r of rows) {
    const m = (current[r.employeeId] ??= {});
    for (const d of r.days) if (d.code) m[`${r.month}-${String(d.day).padStart(2, "0")}`] = d.code;
  }
  return {
    fileName: file.name,
    log,
    employees: employees.filter((e) => months.some((m) => isWorkingInMonth(e, m)) || e.deviceId),
    current,
    weeklyOffDay: settings.weeklyOffDay,
    closed: closed.filter((m) => months.includes(m)),
    holidays: [...(await getHolidays(prisma, log.start, log.end))],
  };
}

export interface ApplyInput {
  /** رقم الجهاز ← معرّف الموظف (فارغ = بلا ربط) */
  mapping: Record<string, string>;
  changes: { employeeId: string; date: string; code: string | null }[];
  /** أوقات الدخول والخروج لكل يوم فيه بصمة */
  times?: { employeeId: string; date: string; checkIn: string; checkOut: string | null }[];
}

export type ApplyResult =
  | { ok: true; changed: number; linked: number; months: string[]; timesSaved: number; overtimeDays: number }
  | { ok: false; error: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** يحفظ ربط أرقام الجهاز بالموظفين، ثم يكتب الرموز المعتمدة (مع سجل التدقيق). */
export async function applyPunchLog(input: ApplyInput): Promise<ApplyResult> {
  const user = await requireAdmin();
  const changes = input.changes ?? [];
  for (const c of changes) {
    if (!DATE.test(c.date)) return { ok: false, error: `تاريخ غير صحيح: ${c.date}` };
    if (c.code !== null && !isValidCode(c.code)) return { ok: false, error: INVALID_CODE_MESSAGE };
  }
  const times = input.times ?? [];
  for (const t of times) if (!DATE.test(t.date)) return { ok: false, error: `تاريخ غير صحيح: ${t.date}` };
  const months = [...new Set([...changes, ...times].map((c) => c.date.slice(0, 7)))].sort();
  const closed = (await closedMonths(prisma)).filter((m) => months.includes(m));
  if (closed.length) return { ok: false, error: `شهر ${closed.join("، ")} معتمد ومقفل — أعد فتحه من «الكشف الشهري» قبل الاستيراد` };

  // 1) ربط أرقام الجهاز
  const targetIds = Object.values(input.mapping ?? {}).filter(Boolean);
  if (new Set(targetIds).size !== targetIds.length) return { ok: false, error: "ربطت موظفًا واحدًا بأكثر من رقم في الجهاز" };
  const employees = await prisma.employee.findMany();
  const byId = new Map(employees.map((e) => [e.id, e]));
  let linked = 0;
  for (const [deviceId, employeeId] of Object.entries(input.mapping ?? {})) {
    const holder = employees.find((e) => e.deviceId === deviceId);
    if ((holder?.id ?? "") === employeeId) continue;
    if (employeeId && !byId.has(employeeId)) return { ok: false, error: "موظف غير موجود في الربط" };
    if (holder) {
      await prisma.employee.update({ where: { id: holder.id }, data: { deviceId: null } });
      await audit(user, "update", "Employee", holder.id, `إلغاء ربط ${holder.name} برقم البصمة ${deviceId}`, deviceId, null);
      holder.deviceId = null;
    }
    if (employeeId) {
      const emp = byId.get(employeeId)!;
      const before = emp.deviceId;
      await prisma.employee.update({ where: { id: employeeId }, data: { deviceId } });
      await audit(user, "update", "Employee", employeeId, `ربط ${emp.name} برقم البصمة ${deviceId}`, before, deviceId);
      emp.deviceId = deviceId;
      linked++;
    }
  }

  // 2) الرموز
  const rowCache = new Map<string, string | null>();
  let changed = 0;
  for (const c of changes) {
    const emp = byId.get(c.employeeId);
    if (!emp) return { ok: false, error: "موظف غير موجود" };
    if ((emp.hireDate && c.date < emp.hireDate) || (emp.endDate && c.date > emp.endDate)) continue;
    const month = c.date.slice(0, 7);
    const key = `${emp.id}|${month}`;
    let monthId = rowCache.get(key);
    if (monthId === undefined) {
      // سطر محذوف (dupSeq 0) يمنع إنشاء سطر جديد بالقيد الفريد، فنتركه كما هو
      const row = await prisma.attendanceMonth.findFirst({ where: { employeeId: emp.id, month, dupSeq: 0 } });
      if (row) monthId = row.deletedAt ? null : row.id;
      else if (isWorkingInMonth(emp, month)) {
        const created = await prisma.attendanceMonth.create({ data: { employeeId: emp.id, month } });
        await audit(user, "create", "AttendanceMonth", created.id, `إضافة سطر ${emp.name} لشهر ${month} (استيراد البصمة)`);
        monthId = created.id;
      } else monthId = null;
      rowCache.set(key, monthId);
    }
    if (!monthId) continue;
    if (await setAttendanceCode(monthId, Number(c.date.slice(8)), c.code, user)) changed++;
  }

  // 3) أوقات الدوام والإضافي التلقائي (لا يُستبدل وقت أدخله المدير يدويًا)
  const [settings, holidays] = await Promise.all([getSettings(prisma), getHolidays(prisma)]);
  let timesSaved = 0;
  let overtimeDays = 0;
  for (const t of times) {
    const emp = byId.get(t.employeeId);
    if (!emp || (emp.hireDate && t.date < emp.hireDate) || (emp.endDate && t.date > emp.endDate)) continue;
    try {
      const r = await saveTime(user, { ...t, source: TIME_SOURCE_DEVICE }, { keepManual: true, settings, holidays });
      if (r.changed) timesSaved++;
      if (r.entry && (await prisma.extraEntry.count({ where: { timeEntryId: r.entry.id, deletedAt: null } }))) overtimeDays++;
    } catch (e) {
      if (e instanceof TimeInputError) continue; // بصمة بوقت غير مفهوم: تُتجاهل
      throw e;
    }
  }
  revalidatePath("/", "layout");
  return { ok: true, changed, linked, months, timesSaved, overtimeDays };
}
