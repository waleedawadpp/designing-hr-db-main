import { prisma } from "@/lib/db";
import { buildMonthlyReport, type ReportRow } from "@/lib/report";
import { decorateDeductions, decorateExtras } from "@/lib/entries";
import { formatDate, formatMonth, formatOMR, format1, monthBounds } from "@/lib/payroll";
import { monthFromParams } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { PrintButton } from "@/components/leave/print-button";
import { PayslipControls } from "@/components/payslip/payslip-controls";

export const dynamic = "force-dynamic";

const n1 = (v: number) => (Number.isInteger(v) ? String(v) : format1(v));

export default async function PayslipPage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string; emp?: string }> }) {
  const sp = await searchParams;
  const ym = monthFromParams(sp);
  const report = await buildMonthlyReport(prisma, ym);
  const empId = sp.emp && (sp.emp === "all" || report.rows.some((r) => r.employeeId === sp.emp)) ? sp.emp : report.rows[0]?.employeeId ?? "all";
  const rows = empId === "all" ? report.rows : report.rows.filter((r) => r.employeeId === empId);

  // تفاصيل البنود (أسطر الإضافي والخصم المربوطة في الشهر)
  const { start, end } = monthBounds(ym);
  const ids = rows.map((r) => r.employeeId);
  const where = { deletedAt: null, date: { gte: start, lte: end }, employeeId: { in: ids }, item: { not: null } };
  const [extras, deductions] = await Promise.all([
    decorateExtras(prisma, await prisma.extraEntry.findMany({ where, include: { employee: true }, orderBy: { date: "asc" } })),
    decorateDeductions(prisma, await prisma.deductionEntry.findMany({ where, include: { employee: true }, orderBy: { date: "asc" } })),
  ]);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={`قسائم الرواتب | ${formatMonth(ym)}`}
        hint={report.closed ? "🔒 الشهر معتمد — القسيمة من الرواتب المعتمدة" : "⚠ الشهر غير معتمد بعد — الأرقام قد تتغير حتى يُعتمد من «الكشف الشهري»"}
        actions={<PrintButton label={empId === "all" ? "طباعة كل القسائم" : "طباعة القسيمة"} />}
      />
      <PayslipControls ym={ym} empId={empId} employees={report.rows.map((r) => ({ value: r.employeeId, label: `${r.employee.code} — ${r.employee.name}` }))} />
      {rows.length === 0 && <div className="rounded-lg border border-line bg-white p-6 text-center text-slate-500">لا يوجد عاملون في هذا الشهر.</div>}
      <div className="space-y-6">
        {rows.map((r) => (
          <Payslip
            key={r.employeeId}
            ym={ym}
            row={r}
            closed={!!report.closed}
            extras={extras.filter((x) => x.employeeId === r.employeeId && x.status.kind === "linked")}
            deductions={deductions.filter((x) => x.employeeId === r.employeeId && x.status.kind === "linked")}
          />
        ))}
      </div>
    </div>
  );
}

function Payslip({
  ym,
  row,
  closed,
  extras,
  deductions,
}: {
  ym: string;
  row: ReportRow;
  closed: boolean;
  extras: Awaited<ReturnType<typeof decorateExtras>>;
  deductions: Awaited<ReturnType<typeof decorateDeductions>>;
}) {
  const e = row.employee;
  const driver = e.type === "سائق يومي";
  const earnings = row.due + row.overtime + row.bonuses;
  return (
    <section className="payslip overflow-hidden rounded-lg border border-line bg-white shadow-sm" data-testid={`payslip-${e.code}`}>
      <header className="flex items-center justify-between border-b-2 border-gold bg-navy px-5 py-3 text-white">
        <div>
          <div className="text-lg font-bold">قسيمة راتب</div>
          <div className="text-sm text-slate-300">شهر {formatMonth(ym)}</div>
        </div>
        <div className="text-left text-sm">{closed ? "معتمدة" : "مسودة — الشهر غير معتمد"}</div>
      </header>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 bg-cream px-5 py-3 text-sm sm:grid-cols-4">
        <Info label="الرقم الوظيفي" value={e.code} />
        <Info label="الاسم" value={e.name} />
        <Info label="النوع" value={e.type} />
        <Info label={driver ? "الأجرة اليومية" : "الراتب الشهري"} value={formatOMR(driver ? e.dailyWage ?? 0 : e.monthlySalary ?? 0)} />
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <h3 className="mb-1 border-b border-gold pb-1 text-sm font-bold text-navy">الحضور</h3>
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-slate-500">أيام العمل في الشهر</dt><dd>{row.workingDays}</dd>
            <dt className="text-slate-500">أيام الحضور</dt><dd>{n1(row.counts.present)}</dd>
            <dt className="text-slate-500">غياب</dt><dd>{row.counts.absent}</dd>
            <dt className="text-slate-500">نصف يوم</dt><dd>{row.counts.half}</dd>
            <dt className="text-slate-500">إجازة / مرضي</dt><dd>{row.counts.leave} / {row.counts.sick}</dd>
            <dt className="text-slate-500">رصيد الإجازة المتبقي</dt><dd>{n1(row.leaveRemaining)} يوم</dd>
          </dl>
        </div>
        <div>
          <h3 className="mb-1 border-b border-gold pb-1 text-sm font-bold text-navy">المستحقات والاستقطاعات</h3>
          <table className="w-full text-sm">
            <tbody>
              <Line label={driver ? "الأجرة المستحقة (أيام الحضور × الأجرة)" : "الراتب المستحق للشهر"} value={driver ? row.due : row.salary} />
              {!driver && <Line label="خصم الغياب" value={-row.absenceDeduction} />}
              {extras.map((x) => (
                <Line key={x.id} label={`${x.item}${x.item === "ساعات إضافية" ? ` ${x.actualTime} س` : ""} — ${formatDate(x.date)}`} value={x.amount ?? 0} />
              ))}
              {deductions.map((d) => (
                <Line key={d.id} label={`${d.item}${d.item === "تأخير" ? ` ${d.lateMinutes} د` : ""} — ${formatDate(d.date)}`} value={-(d.deducted ?? 0)} />
              ))}
              <tr className="border-t border-line font-semibold text-slate-600">
                <td className="py-1">إجمالي المستحقات</td>
                <td className="money py-1 text-left">{formatOMR(earnings)}</td>
              </tr>
              <tr className="font-semibold text-slate-600">
                <td className="py-0.5">إجمالي الاستقطاعات</td>
                <td className="money py-0.5 text-left">{formatOMR(row.deductions)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className={`mx-5 mb-4 flex items-center justify-between rounded-md px-4 py-3 ${row.net < 0 ? "bg-[#FEE2E2] text-[#B91C1C]" : "bg-[#E8F5EC] text-[#166534]"}`}>
        <span className="font-bold">الصافي المستحق</span>
        <span className="money text-xl font-bold" data-testid="payslip-net">{formatOMR(row.net)}</span>
      </div>
      {row.net < 0 && <p className="mx-5 -mt-2 mb-3 text-xs font-semibold text-[#B91C1C]">⚠ الصافي بالسالب: الاستقطاعات أكبر من المستحق.</p>}
      <footer className="grid grid-cols-2 gap-6 px-5 pb-5 pt-6 text-sm text-slate-600">
        <div className="border-t border-dashed border-slate-400 pt-1">توقيع المحاسب</div>
        <div className="border-t border-dashed border-slate-400 pt-1">توقيع الموظف بالاستلام</div>
      </footer>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="money font-semibold text-navy">{value}</div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <tr>
      <td className="py-0.5">{label}</td>
      <td className={`money py-0.5 text-left ${value < 0 ? "text-[#B91C1C]" : ""}`}>{formatOMR(value)}</td>
    </tr>
  );
}
