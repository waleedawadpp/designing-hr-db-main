"use client";
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { addHoliday, removeHoliday, type SettingsState } from "@/app/(app)/settings/actions";
import { ARABIC_WEEKDAYS, formatDate, weekdayOf } from "@/lib/payroll";

const field = "rounded border border-line px-3 py-1.5 text-sm text-[#0000FF] focus:border-gold focus:outline-none";

export function HolidaysManager({ holidays }: { holidays: { date: string; name: string }[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<SettingsState, FormData>(addHoliday, {});
  const [err, setErr] = useState<string | null>(null);
  const [, start] = useTransition();
  return (
    <div className="rounded-lg border border-line bg-white p-4" data-testid="holidays">
      <h2 className="mb-1 font-bold text-navy">الإجازات الرسمية</h2>
      <p className="mb-3 text-sm text-slate-600">
        أيام مدفوعة لا تُعد غيابًا وتُستبعد من أيام العمل. من يعمل فيها تُحسب كل ساعاته إضافيًا بمعدل العطلات.
      </p>
      <form action={action} className="mb-3 flex flex-wrap items-center gap-2">
        <input name="date" type="date" required min="2020-01-01" aria-label="تاريخ الإجازة" className={field} dir="ltr" />
        <input name="name" required placeholder="اسم الإجازة (مثل: العيد الوطني)" aria-label="اسم الإجازة" className={`${field} min-w-56`} />
        <button disabled={pending} className="rounded bg-navy px-4 py-1.5 text-sm text-white disabled:opacity-50">إضافة</button>
        {(state.error || err) && <span role="alert" className="text-sm font-semibold text-[#B91C1C]">{state.error || err}</span>}
        {state.message && !state.error && <span className="text-sm font-semibold text-[#166534]">{state.message}</span>}
      </form>
      {holidays.length ? (
        <table className="tbl w-full max-w-xl">
          <thead><tr><th>التاريخ</th><th>اليوم</th><th>الإجازة</th><th /></tr></thead>
          <tbody>
            {holidays.map((h) => (
              <tr key={h.date}>
                <td dir="ltr" className="text-right">{formatDate(h.date)}</td>
                <td>{ARABIC_WEEKDAYS[weekdayOf(h.date)]}</td>
                <td>{h.name}</td>
                <td className="!px-1">
                  <button
                    type="button"
                    aria-label={`حذف ${h.name}`}
                    className="text-slate-400 hover:text-[#B91C1C]"
                    onClick={() => {
                      if (!confirm(`حذف «${h.name}»؟`)) return;
                      start(async () => {
                        const r = await removeHoliday(h.date);
                        setErr(r.error ?? null);
                        router.refresh();
                      });
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-slate-400">لا توجد إجازات رسمية مسجلة.</p>
      )}
    </div>
  );
}
