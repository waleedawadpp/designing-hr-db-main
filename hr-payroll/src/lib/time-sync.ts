// أوقات الدوام ← سطور الإضافي التلقائية في «سجل الإضافي».
// كل سطر وقت (موظف + يوم) يقابله سطر إضافي واحد على الأكثر (timeEntryId)، يُنشأ أو يُحدَّث أو يُحذف
// حذفًا منطقيًا كلما تغيّر الوقت أو الإعدادات أو الإجازات الرسمية.
import "server-only";
import type { TimeEntry } from "@prisma/client";
import { prisma } from "./db";
import { audit } from "./audit";
import { setAttendanceCode } from "./attendance-write";
import { assertMonthsOpen, closedMonths } from "./month-close";
import { getHolidays, getSettings } from "./report";
import { HOLIDAY_RATE_KIND, dayTime, isDayOff, minutesToHM, parseClock, type PayrollSettings } from "./payroll";

type User = { email: string };

export const TIME_SOURCE_DEVICE = "بصمة";
export const TIME_SOURCE_MANUAL = "يدوي";

function otNote(e: Pick<TimeEntry, "checkIn" | "checkOut">, holiday: boolean) {
  return `محسوب من الدوام: ${e.checkIn} – ${e.checkOut}${holiday ? " (يوم عطلة)" : ""}`;
}

/** يحدّث سطر الإضافي التلقائي لسطر وقت واحد. يعيد true إن تغيّر شيء. */
export async function syncOvertime(entry: TimeEntry, user: User, settings?: PayrollSettings, holidays?: Set<string>): Promise<boolean> {
  const s = settings ?? (await getSettings(prisma));
  const hol = holidays ?? (await getHolidays(prisma, entry.date, entry.date));
  const holiday = isDayOff(entry.date, s.weeklyOffDay, hol);
  const t = dayTime(entry.checkIn, entry.checkOut, holiday, s.standardHours);
  const existing = await prisma.extraEntry.findUnique({ where: { timeEntryId: entry.id } });

  if (t.overtime > 0) {
    const data = {
      date: entry.date,
      employeeId: entry.employeeId,
      item: "ساعات إضافية",
      actualTime: minutesToHM(t.overtime),
      rateKind: holiday ? HOLIDAY_RATE_KIND : null,
      notes: otNote(entry, holiday),
      deletedAt: null,
    };
    if (!existing) {
      const created = await prisma.extraEntry.create({ data: { ...data, timeEntryId: entry.id } });
      await audit(user, "create", "ExtraEntry", created.id, `إضافي تلقائي ${data.actualTime} س يوم ${entry.date}`, undefined, data);
      return true;
    }
    const same =
      existing.actualTime === data.actualTime &&
      existing.rateKind === data.rateKind &&
      existing.date === data.date &&
      existing.deletedAt === null &&
      existing.item === data.item;
    if (same) return false;
    await prisma.extraEntry.update({ where: { id: existing.id }, data });
    await audit(user, "update", "ExtraEntry", existing.id, `تحديث الإضافي التلقائي يوم ${entry.date}: ${data.actualTime} س`, existing, data);
    return true;
  }
  if (existing && !existing.deletedAt) {
    await prisma.extraEntry.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    await audit(user, "delete", "ExtraEntry", existing.id, `حذف الإضافي التلقائي يوم ${entry.date} (لا إضافي)`);
    return true;
  }
  return false;
}

/** يضع «ح» في خانة اليوم إن كانت فارغة وللموظف بصمة دخول في ذلك اليوم. */
async function markPresent(entry: TimeEntry, user: User) {
  if (!entry.checkIn && !entry.checkOut) return;
  const month = entry.date.slice(0, 7);
  const row = await prisma.attendanceMonth.findFirst({ where: { employeeId: entry.employeeId, month, dupSeq: 0, deletedAt: null } });
  if (!row) return;
  const day = Number(entry.date.slice(8));
  const cur = await prisma.attendanceDay.findUnique({ where: { monthId_day: { monthId: row.id, day } } });
  if (!cur?.code) await setAttendanceCode(row.id, day, "ح", user);
}

export class TimeInputError extends Error {}

/**
 * يحفظ وقت دخول/خروج يوم لموظف، ثم يحدّث الإضافي التلقائي.
 * من البصمة لا يُستبدل وقت أدخله المدير يدويًا.
 */
export async function saveTime(
  user: User,
  input: { employeeId: string; date: string; checkIn: string | null; checkOut: string | null; source: string },
  opts: { keepManual?: boolean; settings?: PayrollSettings; holidays?: Set<string> } = {},
): Promise<{ changed: boolean; entry: TimeEntry | null }> {
  const checkIn = input.checkIn?.trim() || null;
  const checkOut = input.checkOut?.trim() || null;
  if (checkIn && parseClock(checkIn) == null) throw new TimeInputError(`وقت دخول غير صحيح: ${checkIn} — اكتبه بصيغة 08:00`);
  if (checkOut && parseClock(checkOut) == null) throw new TimeInputError(`وقت خروج غير صحيح: ${checkOut} — اكتبه بصيغة 17:00`);
  await assertMonthsOpen(prisma, input.date);

  const before = await prisma.timeEntry.findUnique({ where: { employeeId_date: { employeeId: input.employeeId, date: input.date } } });
  if (before && opts.keepManual && before.source === TIME_SOURCE_MANUAL) return { changed: false, entry: before };
  if (before && before.checkIn === checkIn && before.checkOut === checkOut) {
    // الوقت نفسه: نتأكد فقط من أن الإضافي متزامن
    return { changed: await syncOvertime(before, user, opts.settings, opts.holidays), entry: before };
  }
  if (!before && !checkIn && !checkOut) return { changed: false, entry: null };
  const entry = before
    ? await prisma.timeEntry.update({ where: { id: before.id }, data: { checkIn, checkOut, source: input.source } })
    : await prisma.timeEntry.create({ data: { employeeId: input.employeeId, date: input.date, checkIn, checkOut, source: input.source } });
  await audit(
    user,
    before ? "update" : "create",
    "TimeEntry",
    entry.id,
    `دوام ${input.date}: ${checkIn ?? "—"} – ${checkOut ?? "—"} (${input.source})`,
    before ? { checkIn: before.checkIn, checkOut: before.checkOut, source: before.source } : undefined,
    { checkIn, checkOut, source: input.source },
  );
  await syncOvertime(entry, user, opts.settings, opts.holidays);
  await markPresent(entry, user);
  return { changed: true, entry };
}

/** يعيد حساب الإضافي التلقائي لكل أوقات الأشهر غير المعتمدة (بعد تغيير الإعدادات أو الإجازات). */
export async function resyncOpenTimes(user: User, where: { date?: string } = {}): Promise<number> {
  const [closed, settings, holidays] = await Promise.all([closedMonths(prisma), getSettings(prisma), getHolidays(prisma)]);
  const entries = await prisma.timeEntry.findMany({ where: where.date ? { date: where.date } : undefined });
  let n = 0;
  for (const e of entries) {
    if (closed.includes(e.date.slice(0, 7))) continue;
    if (await syncOvertime(e, user, settings, holidays)) n++;
  }
  return n;
}
