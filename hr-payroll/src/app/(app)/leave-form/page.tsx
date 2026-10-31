import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/report";
import { ARABIC_WEEKDAYS, formatDate, pad2, weekdayOf, yearLeaves, remainingLeave, leaveEntitlement, format1 } from "@/lib/payroll";
import { LeaveControls } from "@/components/leave/leave-controls";
import { PrintButton } from "@/components/leave/print-button";
import { currentMonthKey } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LeaveFormPage({ searchParams }: { searchParams: Promise<{ emp?: string; y?: string }> }) {
  const sp = await searchParams;
  const year = Number(sp.y) || Number(currentMonthKey().slice(0, 4));
  const settings = await getSettings(prisma);
  const employees = await prisma.employee.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const emp = employees.find((e) => e.id === sp.emp) ?? employees[0];

  let dates: string[] = [];
  if (emp) {
    const months = await prisma.attendanceMonth.findMany({
      where: { employeeId: emp.id, deletedAt: null, month: { gte: `${year}-01`, lte: `${year}-12` } },
      include: { days: { where: { code: "إ" } } },
    });
    dates = months.flatMap((m) => m.days.map((d) => `${m.month}-${pad2(d.day)}`)).sort();
  }
  const taken = emp ? yearLeaves(dates.length, emp, year, settings) : 0;
  const lines = Array.from({ length: Math.max(30, dates.length) }, (_, i) => dates[i] ?? null);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-3 overflow-hidden rounded-lg border border-line shadow-sm">
        <div className="flex items-center justify-between border-b-2 border-gold bg-navy px-4 py-3 text-white">
          <h1 className="text-lg font-bold">نموذج الإجازة</h1>
          <PrintButton />
        </div>
        <div className="bg-cream px-4 py-2 text-sm text-slate-700">اختر الموظف والسنة — يُملأ النموذج تلقائيًا من أيام «إ» في سجل الحضور</div>
      </div>
      <div className="rounded-lg border border-line bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-4">
          <span className="text-base font-bold">اسم الموظف :</span>
          <LeaveControls employees={employees.map((e) => ({ value: e.id, label: e.name }))} empId={emp?.id ?? ""} year={year} />
        </div>
        {emp && (
          <div className="mb-3 flex flex-wrap gap-4 text-sm">
            <span>الرقم الوظيفي: <b>{emp.code}</b></span>
            <span>الرصيد السنوي: <b>{leaveEntitlement(emp, settings)} يوم</b></span>
            <span>المسحوب في {year}: <b data-testid="leave-taken">{format1(taken)}</b>{year === settings.systemStartYear && emp.leavesBeforeSystem ? ` (منها ${emp.leavesBeforeSystem} قبل النظام)` : ""}</span>
            <span>المتبقي: <b className={remainingLeave(taken, settings, emp) < 0 ? "text-[#B91C1C]" : "text-[#166534]"}>{format1(remainingLeave(taken, settings, emp))}</b></span>
          </div>
        )}
        <table className="tbl w-full" data-testid="leave-table">
          <thead>
            <tr><th className="w-10">#</th><th>التاريخ</th><th>اليوم</th><th>الإجازة المسحوبة</th><th className="w-40">التوقيع</th><th>ملاحظات</th></tr>
          </thead>
          <tbody>
            {lines.map((d, i) => (
              <tr key={i} className="h-7">
                <td>{i + 1}</td>
                <td dir="ltr" className="text-right">{d ? formatDate(d) : ""}</td>
                <td>{d ? ARABIC_WEEKDAYS[weekdayOf(d)] : ""}</td>
                <td>{d ? `يوم واحد (${i + 1})` : ""}</td>
                <td />
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
