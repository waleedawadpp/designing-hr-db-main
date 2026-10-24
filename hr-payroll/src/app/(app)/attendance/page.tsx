import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { getSettings } from "@/lib/report";
import { isWorkingInMonth, formatMonth } from "@/lib/payroll";
import { AttendanceGrid, type GridRow } from "@/components/attendance/attendance-grid";
import { ExportButtons } from "@/components/export-buttons";
import { getNextMonth } from "./actions";

export const dynamic = "force-dynamic";

const MONTHS_PER_PAGE = 3;

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ month?: string; page?: string }> }) {
  const sp = await searchParams;
  const user = await currentUser();
  const settings = await getSettings(prisma);
  const monthList = (
    await prisma.attendanceMonth.findMany({ where: { deletedAt: null }, distinct: ["month"], select: { month: true }, orderBy: { month: "desc" } })
  ).map((r) => r.month);

  const all = sp.month === "all";
  const page = Math.max(1, Number(sp.page) || 1);
  let months: string[];
  if (all) months = monthList.slice((page - 1) * MONTHS_PER_PAGE, page * MONTHS_PER_PAGE).reverse();
  else months = [sp.month && monthList.includes(sp.month) ? sp.month : monthList[0]].filter(Boolean) as string[];

  const dbRows = await prisma.attendanceMonth.findMany({
    where: { deletedAt: null, month: { in: months } },
    include: { employee: true, days: true },
  });
  dbRows.sort((a, b) => a.month.localeCompare(b.month) || a.employee.sortOrder - b.employee.sortOrder || a.dupSeq - b.dupSeq);

  const counts = new Map<string, number>();
  for (const r of dbRows) counts.set(`${r.employeeId}|${r.month}`, (counts.get(`${r.employeeId}|${r.month}`) ?? 0) + 1);

  const rows: GridRow[] = dbRows.map((r) => {
    const days: (string | null)[] = Array.from({ length: 31 }, () => null);
    for (const d of r.days) if (d.day >= 1 && d.day <= 31) days[d.day - 1] = d.code || null;
    return {
      id: r.id,
      month: r.month,
      code: r.employee.code,
      name: r.employee.name,
      hireDate: r.employee.hireDate,
      endDate: r.employee.endDate,
      days,
      notes: r.notes ?? "",
      duplicate: (counts.get(`${r.employeeId}|${r.month}`) ?? 0) > 1,
    };
  });

  const nextMonth = await getNextMonth();
  const employees = await prisma.employee.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const existingNext = new Set(
    (await prisma.attendanceMonth.findMany({ where: { month: nextMonth, deletedAt: null }, select: { employeeId: true } })).map((r) => r.employeeId),
  );
  const preview = employees.filter((e) => isWorkingInMonth(e, nextMonth) && !existingNext.has(e.id)).map((e) => `${e.code} — ${e.name}`);

  return (
    <div>
      <div className="mb-3 overflow-hidden rounded-lg border border-line shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-gold bg-navy px-4 py-3 text-white">
          <h1 className="text-base font-bold">
            إدخال الحضور الشهري&nbsp;&nbsp; ح = حاضر | غ = غائب | ن = نصف يوم | إ = إجازة | م = مرضي&nbsp;&nbsp; (الخانة الفارغة = لم يُسجَّل)
          </h1>
          <div className="no-print flex gap-2">
            <ExportButtons table="attendance" params={{ month: all ? "all" : months[0] ?? "" }} />
          </div>
        </div>
        <div className="bg-cream px-4 py-2 text-sm text-slate-700">
          ▼ اختر الشهر ثم اضغط خانة اليوم واختر الرمز، أو اكتب الحرف مباشرة • تنقّل بالأسهم و Tab • الحفظ تلقائي
        </div>
      </div>
      <AttendanceGrid
        key={months.join(",")}
        rows={rows}
        monthList={monthList}
        selected={all ? "all" : months[0] ?? ""}
        page={page}
        pageCount={Math.max(1, Math.ceil(monthList.length / MONTHS_PER_PAGE))}
        weeklyOffDay={settings.weeklyOffDay}
        canEdit={user?.role === "admin"}
        nextMonth={nextMonth}
        nextMonthLabel={formatMonth(nextMonth)}
        preview={preview}
      />
    </div>
  );
}
