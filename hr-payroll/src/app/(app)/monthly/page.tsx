import { PageHeader } from "@/components/page-header";
import { MonthPicker } from "@/components/month-picker";
import { ExportButtons } from "@/components/export-buttons";
import { prisma } from "@/lib/db";
import { buildMonthlyReport, sumRows } from "@/lib/report";
import { ARABIC_WEEKDAYS_SHORT, fmtNumber3, format1, formatDate, formatMonth, pad2, weekdayOf } from "@/lib/payroll";
import { monthFromParams } from "@/lib/utils";
import { currentUser } from "@/lib/auth";
import { MonthCloseBar } from "@/components/monthly/month-close-bar";
import Link from "next/link";

export const dynamic = "force-dynamic";

const n3 = (v: number) => fmtNumber3(v);
const n1 = (v: number) => (Number.isInteger(v) ? String(v) : format1(v));

export default async function MonthlyPage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string }> }) {
  const sp = await searchParams;
  const ym = monthFromParams(sp);
  const [r, user] = await Promise.all([buildMonthlyReport(prisma, ym), currentUser()]);
  const t = sumRows(r.rows);
  const negatives = r.rows.filter((x) => x.net < 0).length;
  const dayList = Array.from({ length: r.days }, (_, i) => i + 1);

  return (
    <div>
      <PageHeader
        title={`الكشف الشهري للحضور والرواتب | ${formatMonth(ym)}`}
        hint="ح حاضر | غ غائب | إ إجازة | م مرضي | ن نصف يوم"
        actions={<ExportButtons table="monthly" params={{ ym }} printLabel="طباعة / PDF" />}
      />
      <div className="no-print mb-3 flex flex-wrap items-center gap-4 rounded-lg border border-line bg-white px-4 py-2">
        <MonthPicker ym={ym} />
        <span className="text-sm">من <b dir="ltr">{formatDate(r.start)}</b></span>
        <span className="text-sm">إلى <b dir="ltr">{formatDate(r.end)}</b></span>
        <span className="ms-auto">
          <MonthCloseBar ym={ym} label={formatMonth(ym)} closed={r.closed} canEdit={user?.role === "admin"} negatives={negatives} />
        </span>
      </div>
      {negatives > 0 && (
        <div role="alert" className="no-print mb-3 rounded border border-[#B91C1C] bg-[#FEE2E2] px-3 py-2 text-sm font-semibold text-[#B91C1C]">
          ⚠ {negatives} موظف صافيهم بالسالب هذا الشهر (الخصومات أكبر من المستحق) — راجع السلف والغرامات قبل الاعتماد.
        </div>
      )}
      <div className="hidden print:block mb-2 text-sm">من {formatDate(r.start)} إلى {formatDate(r.end)}</div>

      <div className="print-full fit-print max-h-[calc(100vh-210px)] overflow-auto rounded-lg border border-line bg-white">
        <table className="tbl" data-testid="monthly-table">
          <thead>
            <tr>
              <th className="col-code sticky right-0 z-[3] hidden w-[70px] min-w-[70px] sm:table-cell print:table-cell">الرقم</th>
              <th className="col-name sticky right-0 z-[3] min-w-[120px] sm:right-[70px] sm:min-w-[170px]">الاسم</th>
              {dayList.map((d) => {
                const wd = weekdayOf(`${ym}-${pad2(d)}`);
                return (
                  <th key={d} className="col-day w-7 min-w-7 !px-0 text-center align-bottom">
                    <div className="wd mx-auto text-[10px] font-normal [writing-mode:vertical-rl]">{ARABIC_WEEKDAYS_SHORT[wd]}</div>
                    <div>{d}</div>
                  </th>
                );
              })}
              <th className="th-total col-cnt">أيام الحضور</th>
              <th className="th-total col-cnt">غياب</th>
              <th className="th-total col-cnt">نصف يوم</th>
              <th className="th-total col-cnt">إجازة</th>
              <th className="th-total col-cnt">مرضي</th>
              <th className="col-type">النوع</th>
              <th className="th-total col-money">الراتب / الأجرة</th>
              <th className="th-total col-money">الأجرة اليومية</th>
              <th className="th-red col-money">خصم الغياب</th>
              <th className="th-total col-money">المستحق</th>
              <th className="th-total col-money">الإضافي</th>
              <th className="th-green col-money">المكافآت</th>
              <th className="th-red col-money">الخصومات والغرامات</th>
              <th className="th-gold col-money">الصافي</th>
              <th className="th-total col-leave">إجازات السنة</th>
              <th className="th-total col-leave">المتبقي من الرصيد</th>
            </tr>
          </thead>
          <tbody>
            {r.rows.map((row) => (
              <tr key={row.employeeId} data-testid={`monthly-row-${row.employee.code}`}>
                <td className="sticky right-0 z-[1] hidden sm:table-cell print:table-cell">{row.employee.code}</td>
                <td className="sticky right-0 z-[1] font-medium sm:right-[70px]">
                  <Link href={`/payslip?y=${ym.slice(0, 4)}&m=${+ym.slice(5)}&emp=${row.employeeId}`} className="hover:text-navy-2 hover:underline" title="قسيمة الراتب">
                    {row.employee.name}
                  </Link>
                </td>
                {row.codesByDay.map((c, i) => {
                  const fri = weekdayOf(`${ym}-${pad2(i + 1)}`) === r.settings.weeklyOffDay;
                  return (
                    <td key={i} className={`!px-0 text-center ${c ? `c-${c}` : fri ? "c-fri" : ""}`}>
                      {c ?? ""}
                    </td>
                  );
                })}
                <td className="num">{n1(row.counts.present)}</td>
                <td className="num">{row.counts.absent}</td>
                <td className="num">{row.counts.half}</td>
                <td className="num">{row.counts.leave}</td>
                <td className="num">{row.counts.sick}</td>
                <td>{row.employee.type}</td>
                <td className="num">{n3(row.salary)}</td>
                <td className="num">{n3(row.daily)}</td>
                <td className="num text-[#B91C1C]">{n3(row.absenceDeduction)}</td>
                <td className="num">{n3(row.due)}</td>
                <td className="num">{n3(row.overtime)}</td>
                <td className="num text-[#166534]">{n3(row.bonuses)}</td>
                <td className="num text-[#B91C1C]">{n3(row.deductions)}</td>
                <td className={`num font-bold ${row.net < 0 ? "!bg-[#FEE2E2] text-[#B91C1C]" : ""}`} data-testid="net">{n3(row.net)}</td>
                <td className="num">{n1(row.yearLeaves)}</td>
                <td className={`num ${row.leaveRemaining < 0 ? "text-[#B91C1C]" : ""}`}>{n1(row.leaveRemaining)}</td>
              </tr>
            ))}
            <tr className="font-bold [&>td]:!bg-[#E8F5EC]">
              <td className="sticky right-0 z-[1] hidden sm:table-cell print:table-cell" />
              <td className="sticky right-0 z-[1] sm:right-[70px]">الإجمالي</td>
              {r.presentPerDay.map((p, i) => (
                <td key={i} className="!px-0 text-center">{p.all || ""}</td>
              ))}
              <td className="num">{n1(t.present)}</td>
              <td className="num">{t.absent}</td>
              <td className="num">{t.half}</td>
              <td className="num">{t.leave}</td>
              <td className="num">{t.sick}</td>
              <td />
              <td className="num">{n3(t.salary)}</td>
              <td className="num">{n3(t.daily)}</td>
              <td className="num">{n3(t.absenceDeduction)}</td>
              <td className="num">{n3(t.due)}</td>
              <td className="num">{n3(t.overtime)}</td>
              <td className="num">{n3(t.bonuses)}</td>
              <td className="num">{n3(t.deductions)}</td>
              <td className="num" data-testid="net-total">{n3(t.net)}</td>
              <td className="num">{n1(t.yearLeaves)}</td>
              <td className="num">{n1(t.leaveRemaining)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">المبالغ بالريال العماني (ر.ع.) بثلاث منازل عشرية.</p>
    </div>
  );
}
