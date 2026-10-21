import { prisma } from "@/lib/db";
import { buildMonthlyReport } from "@/lib/report";
import { formatMonth } from "@/lib/payroll";
import { monthFromParams } from "@/lib/utils";
import { DashboardClient, type DashRow } from "@/components/dashboard/dashboard-client";
import { ExportButtons } from "@/components/export-buttons";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string }> }) {
  const sp = await searchParams;
  const ym = monthFromParams(sp);
  const r = await buildMonthlyReport(prisma, ym);
  const rows: DashRow[] = r.rows.map((x) => ({
    id: x.employeeId,
    code: x.employee.code,
    name: x.employee.name,
    type: x.employee.type,
    present: x.counts.present,
    workingDays: x.workingDays,
    rate: x.rate,
    salary: x.salary,
    due: x.due,
    extras: x.overtime + x.bonuses,
    deductions: x.deductions,
    net: x.net,
    codes: x.codesByDay,
  }));
  return (
    <div>
      <div className="mb-3 overflow-hidden rounded-lg border border-line shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-gold bg-navy px-4 py-3 text-white">
          <h1 className="text-lg font-bold">لوحة تحكم الموظفين | شهر {formatMonth(ym)}</h1>
          <div className="no-print flex gap-2"><ExportButtons table="dashboard" params={{ ym }} /></div>
        </div>
      </div>
      <DashboardClient ym={ym} rows={rows} presentPerDay={r.presentPerDay} extrasCount={r.extrasCount} />
    </div>
  );
}
