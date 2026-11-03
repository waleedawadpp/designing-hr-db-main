// تجميع أيام الإجازة «إ» لكل موظف ولكل سنة — أساس سجل الإجازات مع الترحيل (leaveLedger في payroll.ts).
import type { PrismaClient } from "@prisma/client";

/**
 * employeeId ← (السنة ← عدد أيام «إ»)، لكل سنة حتى upToYear فيها حضور مسجّل للموظف
 * (السنة التي فيها حضور بلا إجازات تُسجَّل بـ 0 حتى يبدأ سجل الإجازات منها).
 */
export async function leaveDaysByEmployee(db: PrismaClient, upToYear: number, employeeId?: string): Promise<Map<string, Map<number, number>>> {
  const rows = await db.attendanceMonth.findMany({
    where: { deletedAt: null, month: { lte: `${upToYear}-12` }, ...(employeeId ? { employeeId } : {}) },
    select: { employeeId: true, month: true, days: { where: { code: "إ" }, select: { day: true } } },
  });
  const out = new Map<string, Map<number, number>>();
  for (const r of rows) {
    const year = Number(r.month.slice(0, 4));
    const byYear = out.get(r.employeeId) ?? new Map<number, number>();
    byYear.set(year, (byYear.get(year) ?? 0) + r.days.length);
    out.set(r.employeeId, byYear);
  }
  return out;
}
