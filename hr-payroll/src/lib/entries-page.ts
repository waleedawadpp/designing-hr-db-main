// تحميل صفحة من سجل الإضافي أو الخصم مع ترقيم الصفحات.
import { prisma } from "./db";
import { isWorkingInMonth, monthBounds } from "./payroll";
import { decorateDeductions, decorateExtras, UNLINKED_WHERE } from "./entries";
import { closedMonths } from "./month-close";

export const PAGE_SIZE = 50;

export async function loadEntries(kind: "extra" | "deduction", ym: string | "all", page: number) {
  const where =
    ym === "all"
      ? { deletedAt: null }
      : (() => {
          const { start, end } = monthBounds(ym);
          // الأسطر بلا تاريخ تظهر دائمًا حتى تُكمَل
          return { deletedAt: null, OR: [{ date: { gte: start, lte: end } }, { date: null }] };
        })();
  // الأسطر بلا تاريخ أولًا في SQLite و PostgreSQL على حد سواء
  const orderBy = [{ date: { sort: "asc" as const, nulls: "first" as const } }, { createdAt: "asc" as const }];
  const args = { where, orderBy, include: { employee: true }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE };
  const [total, unlinked, rows] =
    kind === "extra"
      ? await Promise.all([prisma.extraEntry.count({ where }), prisma.extraEntry.count({ where: UNLINKED_WHERE }), prisma.extraEntry.findMany(args)])
      : await Promise.all([prisma.deductionEntry.count({ where }), prisma.deductionEntry.count({ where: UNLINKED_WHERE }), prisma.deductionEntry.findMany(args)]);
  const employees = (await prisma.employee.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }))
    .filter((e) => (ym === "all" ? !e.endDate || e.endDate >= new Date().toISOString().slice(0, 10) : isWorkingInMonth(e, ym)))
    .map((e) => ({ value: e.id, label: e.name }));
  const views =
    kind === "extra"
      ? await decorateExtras(prisma, rows as Parameters<typeof decorateExtras>[1])
      : await decorateDeductions(prisma, rows as Parameters<typeof decorateDeductions>[1]);
  return { total, unlinked, rows: views, employees, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)), closedMonths: await closedMonths(prisma) };
}
