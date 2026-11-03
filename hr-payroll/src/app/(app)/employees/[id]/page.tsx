import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { buildMonthlyReport, getSettings } from "@/lib/report";
import { leaveDaysByEmployee } from "@/lib/leave";
import {
  ARABIC_WEEKDAYS, CODES, countCodes, daysInMonth, employeeStatus, format1, formatDate, formatMonth, formatOMR, leaveLedger, pad2, weekdayOf,
} from "@/lib/payroll";
import { todayISO } from "@/lib/utils";
import { RangeEntryForm } from "@/components/attendance/range-entry-form";
import { EmployeeEditButton } from "@/components/employees/employee-edit-button";
import { YearPicker } from "@/components/employees/year-picker";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const CODE_LABELS: Record<string, string> = { "ح": "حاضر", "غ": "غائب", "ن": "نصف يوم", "إ": "إجازة", "م": "مرضي" };

/** فترات متصلة لنفس الرمز (إجازة أو مرضي) */
function periods(dates: { date: string; code: string }[]) {
  const out: { code: string; from: string; to: string; days: number }[] = [];
  for (const d of dates) {
    const last = out.at(-1);
    const prev = last && new Date(`${last.to}T00:00:00Z`);
    if (prev) prev.setUTCDate(prev.getUTCDate() + 1);
    if (last && last.code === d.code && prev!.toISOString().slice(0, 10) === d.date) {
      last.to = d.date;
      last.days++;
    } else out.push({ code: d.code, from: d.date, to: d.date, days: 1 });
  }
  return out;
}

export default async function EmployeePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ year?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const emp = await prisma.employee.findUnique({ where: { id } });
  if (!emp) notFound();
  const user = await currentUser();
  const canEdit = user?.role === "admin";
  const settings = await getSettings(prisma);
  const today = todayISO();
  const thisYear = Number(today.slice(0, 4));

  const allRows = await prisma.attendanceMonth.findMany({ where: { employeeId: id, deletedAt: null }, select: { month: true } });
  const dataYears = [...new Set(allRows.map((r) => Number(r.month.slice(0, 4))))];
  const lastYear = Math.max(thisYear, ...dataYears);
  const leaveDays = (await leaveDaysByEmployee(prisma, lastYear, id)).get(id) ?? new Map<number, number>();
  const ledger = leaveLedger(emp, leaveDays, lastYear, settings);
  const years = [...new Set([...ledger.map((l) => l.year), ...dataYears, thisYear])].sort((a, b) => b - a);
  const year = Number(sp.year) && years.includes(Number(sp.year)) ? Number(sp.year) : thisYear;

  // حضور السنة: أول رمز غير فارغ لكل يوم من كل أسطر الشهر
  const monthRows = await prisma.attendanceMonth.findMany({
    where: { employeeId: id, deletedAt: null, month: { gte: `${year}-01`, lte: `${year}-12` } },
    orderBy: { dupSeq: "asc" },
    include: { days: true },
  });
  const grid = new Map<string, (string | null)[]>();
  for (const r of monthRows) {
    const g = grid.get(r.month) ?? Array.from({ length: 31 }, () => null);
    for (const d of r.days) if (d.code && d.day >= 1 && d.day <= 31 && !g[d.day - 1]) g[d.day - 1] = d.code;
    grid.set(r.month, g);
  }
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${pad2(i + 1)}`);
  const leaveDates = months.flatMap((m) => (grid.get(m) ?? []).flatMap((c, i) => (c === "إ" || c === "م" ? [{ date: `${m}-${pad2(i + 1)}`, code: c }] : [])));
  const leavePeriods = periods(leaveDates);

  // الرواتب: أشهر السنة التي فيها حضور مسجّل
  const salaryMonths = months.filter((m) => grid.has(m));
  const salaries = (await Promise.all(salaryMonths.map((m) => buildMonthlyReport(prisma, m)))).flatMap((rep) => {
    const row = rep.rows.find((r) => r.employeeId === id);
    return row ? [{ ym: rep.ym, row, closed: !!rep.closed }] : [];
  });

  const ly = ledger.find((l) => l.year === year);
  const employees = [{ id: emp.id, label: emp.name }];

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-line shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-gold bg-navy px-4 py-3 text-white">
          <h1 className="text-lg font-bold" data-testid="emp-title">{emp.name} <span className="text-sm font-normal text-[#C9A227]">{emp.code} • {emp.type}</span></h1>
          <div className="flex gap-2">
            <Link href="/employees" className="rounded border border-white/40 px-3 py-1 text-sm">← كل الموظفين</Link>
            {canEdit && (
              <EmployeeEditButton
                id={emp.id}
                defaultLeave={settings.annualLeaveEntitlement}
                initial={{
                  code: emp.code, name: emp.name, type: emp.type,
                  monthlySalary: emp.monthlySalary?.toString() ?? "", dailyWage: emp.dailyWage?.toString() ?? "", dailyHours: emp.dailyHours?.toString() ?? "9",
                  hireDate: emp.hireDate, endDate: emp.endDate, leavesBeforeSystem: emp.leavesBeforeSystem?.toString() ?? "",
                  annualLeave: emp.annualLeave?.toString() ?? "", leaveOpeningBalance: emp.leaveOpeningBalance?.toString() ?? "", notes: emp.notes ?? "",
                }}
              />
            )}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 bg-white px-4 py-3 text-sm sm:grid-cols-4">
          <div><dt className="text-slate-500">الحالة</dt><dd className={employeeStatus(emp, today) === "انتهت الخدمة" ? "text-[#B91C1C]" : "text-[#166534]"}>{employeeStatus(emp, today)}</dd></div>
          <div><dt className="text-slate-500">تاريخ التعيين</dt><dd dir="ltr" className="text-right">{formatDate(emp.hireDate) || "—"}</dd></div>
          <div><dt className="text-slate-500">انتهاء الخدمة</dt><dd dir="ltr" className="text-right">{formatDate(emp.endDate) || "—"}</dd></div>
          <div><dt className="text-slate-500">{emp.type === "سائق يومي" ? "الأجرة اليومية" : "الراتب الشهري"}</dt><dd>{formatOMR((emp.type === "سائق يومي" ? emp.dailyWage : emp.monthlySalary) ?? 0)}</dd></div>
        </dl>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <YearPicker years={years} year={year} />
        {ly && (
          <div className="flex flex-wrap gap-2 text-sm" data-testid="leave-summary">
            <span className="rounded bg-white px-3 py-1 ring-1 ring-line">مُرحّل من {year - 1}: <b>{format1(ly.carried)}</b></span>
            <span className="rounded bg-white px-3 py-1 ring-1 ring-line">رصيد {year}: <b>{ly.entitlement}</b></span>
            <span className="rounded bg-white px-3 py-1 ring-1 ring-line">المأخوذ: <b>{format1(ly.taken)}</b></span>
            <span className={cn("rounded px-3 py-1 font-semibold ring-1", ly.remaining < 0 ? "bg-[#FEE2E2] text-[#B91C1C] ring-[#B91C1C]/30" : "bg-[#DCFCE7] text-[#166534] ring-[#166534]/30")}>
              المتبقي: <b data-testid="leave-remaining">{format1(ly.remaining)}</b> يوم
            </span>
          </div>
        )}
      </div>

      {canEdit && (
        <div className="rounded-lg border border-gold bg-cream p-3">
          <RangeEntryForm employees={employees} employeeId={emp.id} weeklyOffDayName={ARABIC_WEEKDAYS[settings.weeklyOffDay]} />
        </div>
      )}

      <section className="rounded-lg border border-line bg-white">
        <h2 className="border-b border-line px-4 py-2 font-bold text-navy">حضور {year}</h2>
        <div className="overflow-x-auto">
          <table className="tbl w-full" data-testid="year-grid">
            <thead>
              <tr>
                <th>الشهر</th>
                {Array.from({ length: 31 }, (_, i) => <th key={i} className="w-7 min-w-7 !px-0 text-center">{i + 1}</th>)}
                {CODES.map((c) => <th key={c} className="th-total" title={CODE_LABELS[c]}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {months.map((m) => {
                const g = grid.get(m);
                const dim = daysInMonth(year, Number(m.slice(5)));
                const cnt = countCodes(g ?? []);
                return (
                  <tr key={m} data-testid={`year-row-${m}`}>
                    <td className="whitespace-nowrap">
                      <Link href={`/attendance?month=${m}`} className="text-navy hover:underline">{formatMonth(m)}</Link>
                    </td>
                    {Array.from({ length: 31 }, (_, i) => {
                      const out = i + 1 > dim;
                      const c = g?.[i] ?? null;
                      const off = !out && weekdayOf(`${m}-${pad2(i + 1)}`) === settings.weeklyOffDay;
                      return <td key={i} className={cn("!p-0 text-center text-[13px] font-bold", out ? "c-out" : c ? `c-${c}` : off ? "c-fri" : "")}>{out ? "" : c ?? ""}</td>;
                    })}
                    <td className="calc num">{g ? format1(cnt.present) : ""}</td>
                    <td className="calc num">{g ? cnt.absent : ""}</td>
                    <td className="calc num">{g ? cnt.half : ""}</td>
                    <td className="calc num">{g ? cnt.leave : ""}</td>
                    <td className="calc num">{g ? cnt.sick : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-line bg-white">
          <h2 className="border-b border-line px-4 py-2 font-bold text-navy">سجل رصيد الإجازات (مع الترحيل)</h2>
          <table className="tbl w-full" data-testid="leave-ledger">
            <thead><tr><th>السنة</th><th>المُرحّل</th><th>الاستحقاق</th><th>المأخوذ</th><th>المتبقي</th></tr></thead>
            <tbody>
              {[...ledger].reverse().map((l) => (
                <tr key={l.year} className={cn(l.year === year && "[&>td]:!bg-cream")}>
                  <td>{l.year}</td>
                  <td className="num">{format1(l.carried)}</td>
                  <td className="num">{l.entitlement}</td>
                  <td className="num">{format1(l.taken)}</td>
                  <td className={cn("num font-semibold", l.remaining < 0 && "text-[#B91C1C]")}>{format1(l.remaining)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2 text-xs text-slate-500">
            يبدأ السجل من أقدم سنة فيها حضور مسجّل (أو سنة بداية النظام) ولا يسبق سنة التعيين. المتبقي يُرحَّل للسنة التالية.
            {emp.leaveOpeningBalance ? ` الرصيد الافتتاحي ${format1(emp.leaveOpeningBalance)} يوم أُضيف لأول سنة.` : ""}
          </p>
        </section>

        <section className="rounded-lg border border-line bg-white">
          <h2 className="border-b border-line px-4 py-2 font-bold text-navy">فترات الإجازة والمرضي في {year}</h2>
          <table className="tbl w-full" data-testid="leave-periods">
            <thead><tr><th>النوع</th><th>من</th><th>إلى</th><th>الأيام</th></tr></thead>
            <tbody>
              {leavePeriods.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-slate-500">لا توجد</td></tr>}
              {leavePeriods.map((p) => (
                <tr key={p.from}>
                  <td className={`c-${p.code} font-bold`}>{CODE_LABELS[p.code]}</td>
                  <td dir="ltr" className="text-right">{formatDate(p.from)}</td>
                  <td dir="ltr" className="text-right">{formatDate(p.to)}</td>
                  <td className="num">{p.days}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 text-xs"><Link href={`/leave-form?emp=${emp.id}&y=${year}`} className="text-navy underline">نموذج الإجازة للطباعة ←</Link></div>
        </section>
      </div>

      <section className="rounded-lg border border-line bg-white">
        <h2 className="border-b border-line px-4 py-2 font-bold text-navy">الرواتب في {year}</h2>
        <div className="overflow-x-auto">
          <table className="tbl w-full" data-testid="emp-salaries">
            <thead><tr><th>الشهر</th><th>أيام الحضور</th><th>غياب</th><th>المستحق</th><th>الإضافي والمكافآت</th><th>الخصومات</th><th>الصافي</th><th>الحالة</th><th></th></tr></thead>
            <tbody>
              {salaries.length === 0 && <tr><td colSpan={9} className="p-4 text-center text-slate-500">لا يوجد حضور مسجّل في {year}</td></tr>}
              {salaries.map(({ ym, row, closed }) => (
                <tr key={ym}>
                  <td>{formatMonth(ym)}</td>
                  <td className="num">{format1(row.counts.present)}</td>
                  <td className="num">{row.counts.absent}</td>
                  <td className="num">{formatOMR(row.due)}</td>
                  <td className="num">{formatOMR(row.overtime + row.bonuses)}</td>
                  <td className="num">{formatOMR(row.deductions)}</td>
                  <td className={cn("num font-semibold", row.net < 0 && "text-[#B91C1C]")}>{formatOMR(row.net)}</td>
                  <td>{closed ? "معتمد" : "مفتوح"}</td>
                  <td><Link href={`/payslip?y=${ym.slice(0, 4)}&m=${+ym.slice(5)}&emp=${emp.id}`} className="text-navy underline">القسيمة</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
