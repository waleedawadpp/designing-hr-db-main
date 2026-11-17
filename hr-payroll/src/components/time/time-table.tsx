"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDayTime } from "@/app/(app)/time/actions";
import { formatDate, type DayTime } from "@/lib/payroll";
import { cn } from "@/lib/utils";
import { fmtMinutes } from "./format";

export interface TimeRow {
  date: string;
  weekday: string;
  /** اسم الإجازة الرسمية أو «عطلة أسبوعية» */
  dayLabel: string;
  holiday: boolean;
  checkIn: string;
  checkOut: string;
  source: string;
  time: DayTime;
}

export function TimeTable({
  employeeId,
  rows,
  canEdit,
  closed,
  overtimeRate,
  holidayRate,
}: {
  employeeId: string;
  rows: TimeRow[];
  canEdit: boolean;
  closed: boolean;
  overtimeRate: number;
  holidayRate: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [, start] = useTransition();
  const total = rows.reduce(
    (a, r) => ({
      worked: a.worked + (r.time.worked ?? 0),
      ot: a.ot + (r.time.holiday ? 0 : r.time.overtime),
      otH: a.otH + (r.time.holiday ? r.time.overtime : 0),
      short: a.short + r.time.short,
    }),
    { worked: 0, ot: 0, otH: 0, short: 0 },
  );

  async function save(r: TimeRow, checkIn: string, checkOut: string) {
    if (checkIn === r.checkIn && checkOut === r.checkOut) return;
    setSaved(false);
    const res = await saveDayTime(employeeId, r.date, checkIn, checkOut);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError(null);
    setSaved(true);
    start(() => router.refresh());
  }

  return (
    <div className="space-y-2">
      {closed && (
        <div className="rounded border border-[#166534]/30 bg-[#DCFCE7] px-3 py-2 text-sm font-semibold text-[#166534]">
          🔒 الشهر معتمد ومقفل — الأوقات للقراءة فقط.
        </div>
      )}
      {error && <div role="alert" className="rounded border border-[#B91C1C] bg-[#FEE2E2] px-3 py-2 text-sm font-semibold text-[#B91C1C]">{error}</div>}
      <div className="h-5 text-sm" aria-live="polite">{saved && <span className="text-[#166534]">✔ تم الحفظ — حُدِّث الإضافي في «سجل الإضافي»</span>}</div>
      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="tbl w-full" data-testid="time-table">
          <thead>
            <tr>
              <th>التاريخ</th><th>اليوم</th><th>الدخول</th><th>الخروج</th>
              <th className="th-total">ساعات العمل</th><th className="th-green">الإضافي</th><th className="th-red">النقص</th><th>المصدر</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Row key={r.date} r={r} canEdit={canEdit} onSave={save} overtimeRate={overtimeRate} holidayRate={holidayRate} />
            ))}
            <tr className="font-bold [&>td]:!bg-[#E8F5EC]">
              <td colSpan={4}>المجموع</td>
              <td className="num">{fmtMinutes(total.worked)}</td>
              <td className="num">
                {fmtMinutes(total.ot)}
                {total.otH ? ` + ${fmtMinutes(total.otH)} عطلات` : ""}
              </td>
              <td className="num">{fmtMinutes(total.short)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({
  r,
  canEdit,
  onSave,
  overtimeRate,
  holidayRate,
}: {
  r: TimeRow;
  canEdit: boolean;
  onSave: (r: TimeRow, a: string, b: string) => void;
  overtimeRate: number;
  holidayRate: number;
}) {
  const [inV, setIn] = useState(r.checkIn);
  const [outV, setOut] = useState(r.checkOut);
  const incomplete = (!!r.checkIn || !!r.checkOut) && r.time.worked == null;
  const input = "inp rounded py-1 text-center";
  return (
    <tr data-testid={`time-row-${r.date}`} className={cn(r.holiday && "[&>td]:!bg-[#FEF9C3]")}>
      <td dir="ltr" className="text-right">{formatDate(r.date)}</td>
      <td>
        {r.weekday}
        {r.dayLabel && <span className="ms-1 text-xs font-semibold text-[#B45309]">({r.dayLabel})</span>}
      </td>
      <td className="!py-0">
        <input type="time" aria-label={`دخول ${r.date}`} className={input} value={inV} readOnly={!canEdit} disabled={!canEdit}
          onChange={(e) => setIn(e.target.value)} onBlur={() => onSave(r, inV, outV)} />
      </td>
      <td className="!py-0">
        <input type="time" aria-label={`خروج ${r.date}`} className={input} value={outV} readOnly={!canEdit} disabled={!canEdit}
          onChange={(e) => setOut(e.target.value)} onBlur={() => onSave(r, inV, outV)} />
      </td>
      <td className="num">{incomplete ? <span className="text-xs font-semibold text-[#B45309]">بصمة ناقصة</span> : fmtMinutes(r.time.worked)}</td>
      <td className="num font-semibold text-[#166534]" data-testid="time-ot">
        {r.time.overtime ? `${fmtMinutes(r.time.overtime)} ×${r.time.holiday ? holidayRate : overtimeRate}` : ""}
      </td>
      <td className="num text-[#B91C1C]">{fmtMinutes(r.time.short)}</td>
      <td className="text-xs text-slate-500">{r.source}</td>
    </tr>
  );
}
