"use client";
import { useActionState } from "react";
import { saveSettings, type SettingsState } from "@/app/(app)/settings/actions";
import { ARABIC_WEEKDAYS, HOLIDAY_RATES, OVERTIME_RATES, type PayrollSettings } from "@/lib/payroll";

const field = "mt-1 w-full rounded border border-line px-3 py-2 text-[#0000FF] focus:border-gold focus:outline-none";
const RATE_LABEL: Record<number, string> = { 1.25: "ساعة وربع (1.25)", 1.5: "ساعة ونصف (1.5)", 2: "ساعتان (2)" };

export function SettingsForm({ settings }: { settings: PayrollSettings }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettings, {});
  return (
    <form action={action} className="space-y-4 rounded-lg border border-line bg-white p-4">
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 font-bold text-navy">الدوام والإضافي</legend>
        <label className="block text-sm">ساعات الدوام الرسمية يوميًا
          <input name="standardHours" type="number" min={1} max={16} step={0.25} defaultValue={settings.standardHours} className={field} />
          <span className="text-xs text-slate-500">ما بعدها يُحسب إضافيًا</span>
        </label>
        <label className="block text-sm">الساعة الإضافية تُحسب بـ
          <select name="overtimeRate" defaultValue={settings.overtimeRate} className={field}>
            {OVERTIME_RATES.map((r) => <option key={r} value={r}>{RATE_LABEL[r]}</option>)}
          </select>
          <span className="text-xs text-slate-500">في أيام العمل العادية</span>
        </label>
        <label className="block text-sm">ساعة العمل في العطلات تُحسب بـ
          <select name="holidayRate" defaultValue={settings.holidayRate} className={field}>
            {HOLIDAY_RATES.map((r) => <option key={r} value={r}>{RATE_LABEL[r]}</option>)}
          </select>
          <span className="text-xs text-slate-500">العطلة الأسبوعية والإجازات الرسمية — كل الساعات إضافي</span>
        </label>
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 font-bold text-navy">حساب الراتب الشهري</legend>
        <label className="block text-sm sm:col-span-2">حساب الراتب حسب الأيام المدفوعة ابتداءً من شهر
          <input name="payByAttendanceFrom" type="month" defaultValue={settings.payByAttendanceFrom ?? ""} className={field} dir="ltr" />
          <span className="text-xs text-slate-500">
            الراتب ÷ أيام العمل (أيام الشهر عدا العطلة الأسبوعية للموظف) × الأيام المدفوعة: ح و إ و م والإجازة الرسمية يوم، ن نصف يوم، والغياب والخانة الفارغة لا تُدفع.
            الأشهر قبله تبقى بحساب الإكسل. اتركه فارغًا لإيقاف الحساب الجديد.
          </span>
        </label>
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 font-bold text-navy">خصم التأخير والخروج المبكر</legend>
        <label className="block text-sm">الخصم التلقائي
          <select name="shortDeduction" defaultValue={settings.shortDeduction ? "1" : "0"} className={field}>
            <option value="1">مفعّل</option>
            <option value="0">متوقف</option>
          </select>
          <span className="text-xs text-slate-500">نقص الساعات عن الدوام الرسمي يُخصم ساعة بساعة</span>
        </label>
        <label className="block text-sm">مهلة السماح (دقيقة)
          <input name="graceMinutes" type="number" min={0} max={120} step={1} defaultValue={settings.graceMinutes} className={field} />
          <span className="text-xs text-slate-500">النقص الذي لا يتجاوزها لا يُخصم، وما زاد عليها يُخصم كاملًا</span>
        </label>
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 font-bold text-navy">عام</legend>
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
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="rounded bg-navy px-5 py-1.5 text-sm text-white disabled:opacity-50">حفظ الإعدادات</button>
        {state.error && <span role="alert" className="text-sm font-semibold text-[#B91C1C]">{state.error}</span>}
        {state.ok && <span className="text-sm font-semibold text-[#166534]">✔ تم الحفظ{state.message ? ` — ${state.message}` : ""}</span>}
      </div>
    </form>
  );
}
