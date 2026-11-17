// تجميع بيانات الشهر من قاعدة البيانات ثم الحساب عبر payroll.ts.
// يُستخدم في الشاشات وفي سكربت الاستيراد (لذلك يستقبل عميل Prisma كمعامل).
import type { PrismaClient } from "@prisma/client";
import {
  computeMonthlyRow,
  countCodes,
  isDriver,
  isWorkingInMonth,
  monthBounds,
  parseMonthKey,
  type MonthlyRow,
  type PayrollSettings,
} from "./payroll";

export async function getSettings(db: PrismaClient): Promise<PayrollSettings> {
  const s = await db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  return { systemStartYear: s.systemStartYear, weeklyOffDay: s.weeklyOffDay, annualLeaveEntitlement: s.annualLeaveEntitlement };
}

export interface ReportRow extends MonthlyRow {
  employeeId: string;
  /** رمز كل يوم 1..D (من أول سطر شهري، مثل XMATCH في الإكسل) */
  codesByDay: (string | null)[];
  hasMonthRow: boolean;
}

export interface MonthlyReport {
  ym: string;
  start: string;
  end: string;
  days: number;
  settings: PayrollSettings;
  rows: ReportRow[];
  /** عدد "ح" لكل يوم: الكل، والموظفون، والسواق */
  presentPerDay: { all: number; employees: number; drivers: number }[];
  extrasCount: number;
  /** الشهر معتمد: النتيجة من لقطة وقت الاعتماد */
  closed?: { at: string; by: string };
}

/**
 * كشف الشهر. إن كان الشهر معتمدًا تُعاد اللقطة المحفوظة وقت الاعتماد كما هي
 * (فلا يغيّرها تعديل راتب أو إعدادات لاحقًا). live = true يحسب من البيانات الحالية دائمًا.
 */
export async function buildMonthlyReport(db: PrismaClient, ym: string, opts: { live?: boolean } = {}): Promise<MonthlyReport> {
  if (!opts.live) {
    const closed = await db.monthClose.findUnique({ where: { month: ym } });
    if (closed) {
      const snap = JSON.parse(closed.snapshot) as MonthlyReport;
      return { ...snap, closed: { at: closed.closedAt.toISOString(), by: closed.closedBy } };
    }
  }
  const { start, end, days } = monthBounds(ym);
  const { year } = parseMonthKey(ym);
  const settings = await getSettings(db);

  const [employees, monthRows, extras, deductions, yearLeaveDays, extrasCount] = await Promise.all([
    db.employee.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.attendanceMonth.findMany({
      where: { month: ym, deletedAt: null },
      include: { days: true },
      orderBy: { dupSeq: "asc" },
    }),
    db.extraEntry.findMany({
      where: { deletedAt: null, date: { gte: start, lte: end }, employeeId: { not: null }, item: { not: null } },
    }),
    db.deductionEntry.findMany({
      where: { deletedAt: null, date: { gte: start, lte: end }, employeeId: { not: null }, item: { not: null } },
    }),
    db.attendanceDay.findMany({
      where: { code: "إ", monthRow: { deletedAt: null, month: { gte: `${year}-01`, lte: `${year}-12` } } },
      select: { monthRow: { select: { employeeId: true } } },
    }),
    db.extraEntry.count({
      where: {
        deletedAt: null,
        date: { gte: start, lte: end },
        OR: [{ employeeId: { not: null } }, { rawName: { not: null } }],
      },
    }),
  ]);

  const leavesByEmp = new Map<string, number>();
  for (const d of yearLeaveDays) {
    const id = d.monthRow.employeeId;
    leavesByEmp.set(id, (leavesByEmp.get(id) ?? 0) + 1);
  }

  const rowsByEmp = new Map<string, typeof monthRows>();
  for (const r of monthRows) {
    const list = rowsByEmp.get(r.employeeId) ?? [];
    list.push(r);
    rowsByEmp.set(r.employeeId, list);
  }

  const presentPerDay = Array.from({ length: days }, () => ({ all: 0, employees: 0, drivers: 0 }));
  const rows: ReportRow[] = [];

  for (const e of employees) {
    if (!isWorkingInMonth(e, ym)) continue;
    const mrs = rowsByEmp.get(e.id) ?? [];
    // كل الرموز من كل الأسطر (المكررة تُجمع كما في SUMIFS)
    const allCodes: (string | null)[] = [];
    for (const mr of mrs) for (const d of mr.days) if (d.day <= days) allCodes.push(d.code);
    const first = mrs[0];
    const codesByDay: (string | null)[] = Array.from({ length: days }, () => null);
    if (first) for (const d of first.days) if (d.day <= days) codesByDay[d.day - 1] = d.code || null;

    const row = computeMonthlyRow({
      employee: e,
      ym,
      codes: allCodes,
      extras: extras.filter((x) => x.employeeId === e.id),
      deductions: deductions.filter((x) => x.employeeId === e.id),
      leaveCountInYear: leavesByEmp.get(e.id) ?? 0,
      settings,
    });
    codesByDay.forEach((c, i) => {
      if (c === "ح") {
        presentPerDay[i].all++;
        if (isDriver(e)) presentPerDay[i].drivers++;
        else presentPerDay[i].employees++;
      }
    });
    rows.push({ ...row, employeeId: e.id, codesByDay, hasMonthRow: mrs.length > 0 });
  }

  return { ym, start, end, days, settings, rows, presentPerDay, extrasCount };
}

export function sumRows(rows: ReportRow[]) {
  const t = {
    present: 0, absent: 0, half: 0, leave: 0, sick: 0,
    salary: 0, absenceDeduction: 0, due: 0, overtime: 0, bonuses: 0, deductions: 0, net: 0,
    yearLeaves: 0, leaveRemaining: 0, rate: 0, daily: 0,
  };
  for (const r of rows) {
    t.present += r.counts.present;
    t.absent += r.counts.absent;
    t.half += r.counts.half;
    t.leave += r.counts.leave;
    t.sick += r.counts.sick;
    t.salary += r.salary;
    t.daily += r.daily;
    t.absenceDeduction += r.absenceDeduction;
    t.due += r.due;
    t.overtime += r.overtime;
    t.bonuses += r.bonuses;
    t.deductions += r.deductions;
    t.net += r.net;
    t.yearLeaves += r.yearLeaves;
    t.leaveRemaining += r.leaveRemaining;
    t.rate += r.rate;
  }
  t.rate = rows.length ? t.rate / rows.length : 0;
  return t;
}

export { countCodes };
