"use client";
import { useActionState } from "react";
import { saveSettings, type SettingsState } from "@/app/(app)/settings/actions";
import { ARABIC_WEEKDAYS, type PayrollSettings } from "@/lib/payroll";

const field = "mt-1 w-full rounded border border-line px-3 py-2 text-[#0000FF] focus:border-gold focus:outline-none";

export function SettingsForm({ settings }: { settings: PayrollSettings }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettings, {});
  return (
    <form action={action} className="grid gap-4 rounded-lg border border-line bg-white p-4 sm:grid-cols-3">
      <label className="block text-sm">رصيد الإجازة السنوي (يوم)
        <input name="annualLeaveEntitlement" type="number" min={0} max={365} defaultValue={settings.annualLeaveEntitlement} className={field} />
        <span className="text-xs text-slate-500">يمكن تحديد رصيد خاص لأي موظف في «بيانات الموظفين»</span>
      </label>
      <label className="block text-sm">يوم العطلة الأسبوعية
        <select name="weeklyOffDay" defaultValue={settings.weeklyOffDay} className={field}>
          {ARABIC_WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
        </select>
        <span className="text-xs text-slate-500">يُستبعد من أيام العمل ونسبة الحضور</span>
      </label>
      <label className="block text-sm">سنة بداية النظام
        <input name="systemStartYear" type="number" min={2020} max={2100} defaultValue={settings.systemStartYear} className={field} />
        <span className="text-xs text-slate-500">تُضاف فيها «إجازات مسحوبة قبل النظام»</span>
      </label>
      <div className="sm:col-span-3 flex items-center gap-3">
        <button disabled={pending} className="rounded bg-navy px-5 py-1.5 text-sm text-white disabled:opacity-50">حفظ الإعدادات</button>
        {state.error && <span role="alert" className="text-sm font-semibold text-[#B91C1C]">{state.error}</span>}
        {state.ok && <span className="text-sm font-semibold text-[#166534]">✔ تم الحفظ</span>}
      </div>
    </form>
  );
}
