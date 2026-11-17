import Link from "next/link";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { getHolidays, getSettings } from "@/lib/report";
import { closedMonths } from "@/lib/month-close";
import { ARABIC_WEEKDAYS, dayTime, formatMonth, isDayOff, isWorkingInMonth, monthBounds, pad2, weekdayOf } from "@/lib/payroll";
import { monthFromParams } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { PayslipControls } from "@/components/payslip/payslip-controls";
import { TimeTable, type TimeRow } from "@/components/time/time-table";
import { fmtMinutes } from "@/components/time/format";

export const dynamic = "force-dynamic";

export default async function TimePage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string; emp?: string }> }) {
  const sp = await searchParams;
  const ym = monthFromParams(sp);
  const { start, end, days } = monthBounds(ym);
  const [user, settings, holidaySet, holidayRows, closed, employeesAll, entries] = await Promise.all([
    currentUser(),
    getSettings(prisma),
    getHolidays(prisma, start, end),
    prisma.holiday.findMany({ where: { date: { gte: start, lte: end } } }),
    closedMonths(prisma),
    prisma.employee.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.timeEntry.findMany({ where: { date: { gte: start, lte: end } } }),
  ]);
  const employees = employeesAll.filter((e) => isWorkingInMonth(e, ym));
  const holidayName = new Map(holidayRows.map((h) => [h.date, h.name]));
  const empId = sp.emp && employees.some((e) => e.id === sp.emp) ? sp.emp : "all";
  const isClosed = closed.includes(ym);
  const std = `${settings.standardHours} ساعات`;

  const header = (
    <PageHeader
      title={`الدوام والإضافي | ${formatMonth(ym)}`}
      hint={`الدوام الرسمي ${std} يوميًا — ما بعدها إضافي بمعدل ${settings.overtimeRate} • العمل في يوم ${ARABIC_WEEKDAYS[settings.weeklyOffDay]} والإجازات الرسمية كله إضافي بمعدل ${settings.holidayRate} • النقص عن الدوام يظهر للمراجعة فقط ولا يُخصم تلقائيًا`}
    />
  );
  const controls = (
    <PayslipControls ym={ym} empId={empId} employees={employees.map((e) => ({ value: e.id, label: `${e.code} — ${e.name}` }))} allLabel="كل العاملين (ملخص الشهر)" />
  );

  if (empId === "all") {
    const rows = employees.map((e) => {
      const mine = entries.filter((t) => t.employeeId === e.id);
      let worked = 0, ot = 0, otHoliday = 0, short = 0, incomplete = 0;
      for (const t of mine) {
        const d = dayTime(t.checkIn, t.checkOut, isDayOff(t.date, settings.weeklyOffDay, holidaySet), settings.standardHours);
        if (d.worked == null) {
          if (t.checkIn || t.checkOut) incomplete++;
          continue;
        }
        worked += d.worked;
        short += d.short;
        if (d.holiday) otHoliday += d.overtime;
        else ot += d.overtime;
      }
      return { e, days: mine.filter((t) => t.checkIn || t.checkOut).length, worked, ot, otHoliday, short, incomplete };
    });
    return (
      <div>
        {header}
        {controls}
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <table className="tbl w-full" data-testid="time-summary">
            <thead>
              <tr>
                <th>الرقم</th><th>الاسم</th><th className="th-total">أيام فيها بصمة</th><th className="th-total">ساعات العمل</th>
                <th className="th-green">إضافي عادي ×{settings.overtimeRate}</th><th className="th-green">إضافي عطلات ×{settings.holidayRate}</th>
                <th className="th-red">نقص عن الدوام</th><th className="th-red">بصمة ناقصة</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.e.id} data-testid={`time-sum-${r.e.code}`}>
                  <td>{r.e.code}</td>
                  <td className="font-medium">
                    <Link href={`/time?y=${ym.slice(0, 4)}&m=${+ym.slice(5)}&emp=${r.e.id}`} className="hover:text-navy-2 hover:underline">{r.e.name}</Link>
                  </td>
                  <td className="num">{r.days}</td>
                  <td className="num">{fmtMinutes(r.worked)}</td>
                  <td className="num">{fmtMinutes(r.ot)}</td>
                  <td className="num">{fmtMinutes(r.otHoliday)}</td>
                  <td className={`num ${r.short ? "text-[#B91C1C]" : ""}`}>{fmtMinutes(r.short)}</td>
                  <td className={`num ${r.incomplete ? "font-semibold text-[#B45309]" : ""}`}>{r.incomplete || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">الأوقات بصيغة ساعات:دقائق. اضغط اسم الموظف لعرض أيامه وتعديل أوقاته.</p>
      </div>
    );
  }

  const byDate = new Map(entries.filter((t) => t.employeeId === empId).map((t) => [t.date, t]));
  const rows: TimeRow[] = Array.from({ length: days }, (_, i) => {
    const date = `${ym}-${pad2(i + 1)}`;
    const t = byDate.get(date);
    const off = isDayOff(date, settings.weeklyOffDay, holidaySet);
    return {
      date,
      weekday: ARABIC_WEEKDAYS[weekdayOf(date)],
      dayLabel: holidayName.get(date) ?? (off ? "عطلة أسبوعية" : ""),
      holiday: off,
      checkIn: t?.checkIn ?? "",
      checkOut: t?.checkOut ?? "",
      source: t?.source ?? "",
      time: dayTime(t?.checkIn, t?.checkOut, off, settings.standardHours),
    };
  });
  return (
    <div>
      {header}
      {controls}
      <TimeTable
        key={`${empId}|${ym}`}
        employeeId={empId}
        rows={rows}
        canEdit={user?.role === "admin" && !isClosed}
        closed={isClosed}
        overtimeRate={settings.overtimeRate}
        holidayRate={settings.holidayRate}
      />
    </div>
  );
}
