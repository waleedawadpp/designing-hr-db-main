// حساب الأعمدة المشتقة لسجلي الإضافي والخصم (في الخادم).
import type { DeductionEntry, Employee, ExtraEntry, PrismaClient } from "@prisma/client";
import {
  ABSENT_DAY_WARNING,
  deductionAmount,
  extraAmount,
  extraOnAbsentDay,
  hourlyRate,
  isValidHM,
  linkStatus,
  minuteCost,
  otCountedHours,
  entryRate,
  DEFAULT_SETTINGS,
  type PayrollSettings,
  otDecimalHours,
  type LinkStatus,
} from "./payroll";

export interface ExtraView {
  id: string;
  date: string | null;
  employeeId: string | null;
  name: string | null; // اسم الموظف المربوط أو الاسم الخام
  item: string | null;
  actualTime: number | null;
  bonusAmount: number | null;
  notes: string;
  decimalHours: number | null;
  countedHours: number | null;
  /** معدل الإضافي المطبّق على السطر (1.25 / 1.5 / …) */
  rate: number | null;
  /** سطر محسوب تلقائيًا من أوقات الدوام */
  fromTime: boolean;
  hourlyRate: number | null;
  amount: number | null;
  code: string | null;
  status: LinkStatus;
  warning: string | null;
}

export interface DeductionView {
  id: string;
  date: string | null;
  employeeId: string | null;
  name: string | null;
  item: string | null;
  lateMinutes: number | null;
  amount: number | null;
  notes: string;
  minuteCost: number | null;
  deducted: number | null;
  code: string | null;
  status: LinkStatus;
  /** خصم نقص محسوب تلقائيًا من أوقات الدوام */
  fromTime: boolean;
}

type WithEmp<T> = T & { employee: Employee | null };

async function codesOn(db: PrismaClient, pairs: { employeeId: string; date: string }[]) {
  const months = [...new Set(pairs.map((p) => p.date.slice(0, 7)))];
  const ids = [...new Set(pairs.map((p) => p.employeeId))];
  if (!months.length) return new Map<string, string | null>();
  const rows = await db.attendanceMonth.findMany({
    where: { deletedAt: null, month: { in: months }, employeeId: { in: ids } },
    include: { days: true },
    orderBy: { dupSeq: "asc" },
  });
  const map = new Map<string, string | null>();
  for (const r of rows)
    for (const d of r.days) {
      const k = `${r.employeeId}|${r.month}-${String(d.day).padStart(2, "0")}`;
      if (!map.has(k)) map.set(k, d.code);
    }
  return map;
}

export async function decorateExtras(
  db: PrismaClient,
  list: WithEmp<ExtraEntry>[],
  settings: PayrollSettings = DEFAULT_SETTINGS,
): Promise<ExtraView[]> {
  const codes = await codesOn(
    db,
    list.filter((x) => x.employeeId && x.date && x.item === "ساعات إضافية").map((x) => ({ employeeId: x.employeeId!, date: x.date! })),
  );
  return list.map((x) => {
    const status = linkStatus(
      { date: x.date, hasName: !!(x.employeeId || x.rawName), item: x.item, numbers: [x.actualTime, x.bonusAmount] },
      x.employee?.name,
    );
    const linked = status.kind === "linked" && x.employee;
    const t = x.actualTime;
    const hmOk = t != null && isValidHM(t);
    const warning =
      linked && x.date && extraOnAbsentDay(x.item, codes.get(`${x.employeeId}|${x.date}`)) ? ABSENT_DAY_WARNING : null;
    return {
      id: x.id,
      date: x.date,
      employeeId: x.employeeId,
      name: x.employee?.name ?? x.rawName ?? null,
      item: x.item,
      actualTime: t,
      bonusAmount: x.bonusAmount,
      notes: x.notes ?? "",
      decimalHours: hmOk ? otDecimalHours(t!) : null,
      countedHours: hmOk ? otCountedHours(t!, entryRate(x, settings)) : null,
      rate: x.item === "ساعات إضافية" ? entryRate(x, settings) : null,
      fromTime: !!x.timeEntryId,
      hourlyRate: x.employee && x.date ? hourlyRate(x.employee, x.date, settings) : null,
      amount: linked ? extraAmount(x, x.employee, settings) : null,
      code: x.employee?.code ?? null,
      status,
      warning,
    };
  });
}

export async function decorateDeductions(
  _db: PrismaClient,
  list: WithEmp<DeductionEntry>[],
  settings: PayrollSettings = DEFAULT_SETTINGS,
): Promise<DeductionView[]> {
  return list.map((x) => {
    const status = linkStatus(
      { date: x.date, hasName: !!(x.employeeId || x.rawName), item: x.item, numbers: [x.lateMinutes, x.amount] },
      x.employee?.name,
    );
    const linked = status.kind === "linked" && x.employee;
    return {
      id: x.id,
      date: x.date,
      employeeId: x.employeeId,
      name: x.employee?.name ?? x.rawName ?? null,
      item: x.item,
      lateMinutes: x.lateMinutes,
      amount: x.amount,
      notes: x.notes ?? "",
      minuteCost: x.employee && x.date ? minuteCost(x.employee, x.date, settings) : null,
      deducted: linked ? deductionAmount(x, x.employee, settings) : null,
      code: x.employee?.code ?? null,
      status,
      fromTime: !!x.timeEntryId,
    };
  });
}

/** شرط: السطر غير مربوط (ناقص أو اسم غير موجود) — للشارة أعلى الصفحة. */
export const UNLINKED_WHERE = {
  deletedAt: null,
  OR: [{ date: null }, { item: null }, { employeeId: null }],
};
