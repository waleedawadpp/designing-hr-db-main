"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CheckCheck } from "lucide-react";
import { DateField } from "@/components/date-field";
import { fillPresentOnDate, setCodeOnDate } from "@/app/(app)/attendance/actions";
import { CODES } from "@/lib/payroll";
import { cn } from "@/lib/utils";

interface Row { id: string; code: string; name: string; type: string; value: string | null }

function shift(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const LABELS: Record<string, string> = { "ح": "حاضر", "غ": "غائب", "ن": "نصف", "إ": "إجازة", "م": "مرضي" };

export function DailyEntry({ date, rows: initial, isOffDay, closed, canEdit }: { date: string; rows: Row[]; isOffDay: boolean; closed: boolean; canEdit: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => setRows(initial), [initial]);
  const editable = canEdit && !closed;
  const go = (d: string | null) => d && router.push(`/attendance/day?date=${d}`);

  function set(r: Row, code: string | null) {
    if (!editable || r.value === code) return;
    const prev = r.value;
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, value: code } : x)));
    setError(null);
    setCodeOnDate(r.id, date, code).then((res) => {
      if (!res.ok) {
        setError(res.error);
        setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, value: prev } : x)));
      }
    });
  }

  const counts = Object.fromEntries(CODES.map((c) => [c, rows.filter((r) => r.value === c).length]));
  const empty = rows.filter((r) => !r.value).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white px-3 py-2">
        <button onClick={() => go(shift(date, -1))} aria-label="اليوم السابق" className="rounded border border-line p-1 hover:border-gold"><ChevronRight size={18} /></button>
        <div className="min-w-[130px] rounded border border-line px-2 py-1"><DateField ariaLabel="التاريخ" value={date} clearable={false} onChange={go} /></div>
        <button onClick={() => go(shift(date, 1))} aria-label="اليوم التالي" className="rounded border border-line p-1 hover:border-gold"><ChevronLeft size={18} /></button>
        <span className="text-sm text-slate-600">
          {CODES.map((c) => `${LABELS[c]} ${counts[c]}`).join(" • ")} • لم يُسجَّل <b data-testid="daily-empty">{empty}</b>
        </span>
        {editable && (
          <button
            disabled={pending || empty === 0}
            onClick={() => start(async () => {
              const r = await fillPresentOnDate(date);
              if (r.ok) { setInfo(`تم تسجيل ${r.changed} حاضر`); router.refresh(); } else setError(r.error);
            })}
            className="ms-auto flex items-center gap-1 rounded bg-navy px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            <CheckCheck size={16} color="#C9A227" /> الباقي حاضر ({empty})
          </button>
        )}
      </div>
      {isOffDay && <div className="rounded border border-gold bg-cream px-3 py-2 text-sm">هذا يوم العطلة الأسبوعية.</div>}
      {closed && <div className="rounded border border-[#166534]/30 bg-[#DCFCE7] px-3 py-2 text-sm font-semibold text-[#166534]">🔒 هذا الشهر معتمد ومقفل — للقراءة فقط.</div>}
      {error && <div role="alert" className="rounded border border-[#B91C1C] bg-[#FEE2E2] px-3 py-2 text-sm font-semibold text-[#B91C1C]">{error}</div>}
      {info && !error && <div className="rounded bg-[#DCFCE7] px-3 py-2 text-sm font-semibold text-[#166534]">{info}</div>}

      <div className="overflow-hidden rounded-lg border border-line bg-white">
        {rows.length === 0 && <div className="p-6 text-center text-slate-500">لا يوجد موظفون على رأس العمل في هذا اليوم.</div>}
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2" data-testid={`daily-${r.code}`}>
              <Link href={`/employees/${r.id}`} className="min-w-[180px] flex-1 font-medium text-navy hover:underline">
                {r.name} <span className="text-xs text-slate-500">{r.code} • {r.type}</span>
              </Link>
              <div className="flex gap-1" role="radiogroup" aria-label={`حضور ${r.name}`}>
                {CODES.map((c) => (
                  <button
                    key={c}
                    role="radio"
                    aria-checked={r.value === c}
                    aria-label={`${LABELS[c]} ${r.name}`}
                    disabled={!editable}
                    onClick={() => set(r, c)}
                    className={cn("h-8 min-w-10 rounded px-2 text-sm font-bold ring-1 ring-line", r.value === c ? `c-${c} ring-2 ring-navy` : "bg-white text-slate-400 hover:text-slate-700")}
                  >
                    {c}
                  </button>
                ))}
                <button disabled={!editable || !r.value} onClick={() => set(r, null)} aria-label={`مسح ${r.name}`} className="h-8 rounded px-2 text-xs text-slate-500 ring-1 ring-line disabled:opacity-40">مسح</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
