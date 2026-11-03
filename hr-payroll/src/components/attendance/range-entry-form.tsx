"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DateField } from "@/components/date-field";
import { recordRange } from "@/app/(app)/attendance/actions";
import { CODES } from "@/lib/payroll";
import { cn } from "@/lib/utils";

const CODE_LABELS: Record<string, string> = { "ح": "حاضر", "غ": "غائب", "ن": "نصف يوم", "إ": "إجازة", "م": "مرضي" };
const field = "rounded border border-line bg-white px-2 py-1.5 text-sm text-[#0000FF] focus:border-gold focus:outline-none";

/** تسجيل رمز واحد لموظف على فترة من تاريخ إلى تاريخ — لأي شهر، ويُنشئ سطر الشهر عند الحاجة. */
export function RangeEntryForm({
  employees,
  employeeId: fixedEmployee,
  weeklyOffDayName,
}: {
  employees: { id: string; label: string }[];
  /** موظف محدد مسبقًا (صفحة الموظف) — يُخفي اختيار الموظف */
  employeeId?: string;
  weeklyOffDayName: string;
}) {
  const router = useRouter();
  const [emp, setEmp] = useState(fixedEmployee ?? "");
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [code, setCode] = useState<string>("إ");
  const [skipOffDay, setSkipOffDay] = useState(true);
  const [overwrite, setOverwrite] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await recordRange({ employeeId: emp, from, to, code: code === "clear" ? null : code, overwrite, skipOffDay });
      setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2 text-sm" data-testid="range-form">
      <div className="font-bold">تسجيل لفترة — مثل إجازة من تاريخ إلى تاريخ (لأي شهر سابق أو قادم)</div>
      <div className="flex flex-wrap items-end gap-3">
        {!fixedEmployee && (
          <label className="flex flex-col gap-1">
            <span>الموظف</span>
            <select aria-label="موظف الفترة" className={cn(field, "min-w-[200px]")} value={emp} onChange={(e) => setEmp(e.target.value)} required>
              <option value="" disabled>اختر الموظف</option>
              {employees.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span>من تاريخ</span>
          <div className={cn(field, "min-w-[130px]")}><DateField ariaLabel="من تاريخ" value={from} onChange={(v) => { setFrom(v); if (v && (!to || to < v)) setTo(v); }} /></div>
        </label>
        <label className="flex flex-col gap-1">
          <span>إلى تاريخ</span>
          <div className={cn(field, "min-w-[130px]")}><DateField ariaLabel="إلى تاريخ" value={to} defaultMonth={from?.slice(0, 7)} onChange={setTo} /></div>
        </label>
        <label className="flex flex-col gap-1">
          <span>الرمز</span>
          <select aria-label="رمز الفترة" className={field} value={code} onChange={(e) => setCode(e.target.value)}>
            {CODES.map((c) => <option key={c} value={c}>{c} — {CODE_LABELS[c]}</option>)}
            <option value="clear">مسح الخانات</option>
          </select>
        </label>
        <button disabled={pending || !emp || !from} className="rounded bg-navy px-4 py-1.5 font-semibold text-white disabled:opacity-50">
          {pending ? "جارٍ التسجيل…" : "تسجيل"}
        </button>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-1"><input type="checkbox" checked={skipOffDay} onChange={(e) => setSkipOffDay(e.target.checked)} /> تخطّي يوم العطلة ({weeklyOffDayName})</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} /> استبدال الرموز الموجودة</label>
      </div>
      {msg && (
        <div role={msg.ok ? "status" : "alert"} className={cn("rounded px-3 py-2 font-semibold", msg.ok ? "bg-[#DCFCE7] text-[#166534]" : "border border-[#B91C1C] bg-[#FEE2E2] text-[#B91C1C]")}>
          {msg.text}
        </div>
      )}
    </form>
  );
}
