"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { DateField } from "@/components/date-field";
import { EMP_TYPES } from "@/lib/payroll";
import { saveEmployee, type EmployeeInput } from "@/app/(app)/employees/actions";
import { cn } from "@/lib/utils";

type Errors = Partial<Record<keyof EmployeeInput, string>>;

export const emptyEmployee = (): EmployeeInput => ({
  code: "", name: "", type: "", monthlySalary: "", dailyWage: "", dailyHours: "9",
  hireDate: null, endDate: null, leavesBeforeSystem: "", annualLeave: "", leaveOpeningBalance: "", notes: "",
});

const field = "w-full rounded border border-line bg-white px-3 py-1.5 text-sm text-[#0000FF] focus:border-gold focus:outline-none";

/** نموذج إضافة موظف جديد أو تعديل موظف قائم (للمدير). */
export function EmployeeDialog({
  id,
  initial,
  defaultLeave,
  onClose,
  onSaved,
}: {
  /** null = موظف جديد */
  id: string | null;
  initial: EmployeeInput;
  defaultLeave: number;
  onClose: () => void;
  onSaved: (id: string, input: EmployeeInput) => void;
}) {
  const [v, setV] = useState<EmployeeInput>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !pending && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  const set = (patch: Partial<EmployeeInput>) => setV((s) => ({ ...s, ...patch }));
  const isDriver = v.type === "سائق يومي";
  const isStaff = v.type === "موظف";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await saveEmployee(id, v);
    setPending(false);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    onSaved(res.id, v);
  }

  const label = (text: string, f: keyof EmployeeInput, node: React.ReactNode, hint?: string) => (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{text}</span>
      {node}
      {hint && !errors[f] && <span className="mt-0.5 block text-[11px] text-slate-500">{hint}</span>}
      {errors[f] && <span role="alert" className="mt-0.5 block text-[12px] font-semibold text-[#B91C1C]">{errors[f]}</span>}
    </label>
  );

  const err = (f: keyof EmployeeInput) => errors[f] && "!border-[#B91C1C] !bg-[#FEE2E2]";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && !pending && onClose()}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="emp-dialog-title"
        onSubmit={submit}
        className="w-full max-w-2xl rounded-lg bg-white shadow-xl"
        data-testid="employee-dialog"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 id="emp-dialog-title" className="text-base font-bold text-navy">{id ? `تعديل بيانات: ${initial.name}` : "إضافة موظف جديد"}</h2>
          <button type="button" onClick={onClose} disabled={pending} aria-label="إغلاق" className="rounded p-1 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2">
          {label("الرقم *", "code", <input ref={first} aria-label="الرقم" className={cn(field, err("code"))} dir="ltr" value={v.code} onChange={(e) => set({ code: e.target.value })} />)}
          {label("الاسم *", "name", <input aria-label="الاسم" className={cn(field, err("name"))} value={v.name} onChange={(e) => set({ name: e.target.value })} />)}
          {label("النوع *", "type", (
            <select aria-label="النوع" className={cn(field, err("type"))} value={v.type} onChange={(e) => set({ type: e.target.value })}>
              <option value="" disabled>اختر النوع</option>
              {EMP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          ))}
          {label("ساعات الدوام اليومي", "dailyHours", <input aria-label="ساعات الدوام اليومي" className={cn(field, err("dailyHours"))} dir="ltr" inputMode="decimal" value={v.dailyHours} onChange={(e) => set({ dailyHours: e.target.value })} />)}
          {label(isStaff ? "الراتب الشهري *" : "الراتب الشهري", "monthlySalary",
            <input aria-label="الراتب الشهري" className={cn(field, err("monthlySalary"), isDriver && !v.monthlySalary && "opacity-50")} dir="ltr" inputMode="decimal" disabled={isDriver && !v.monthlySalary} value={v.monthlySalary} onChange={(e) => set({ monthlySalary: e.target.value })} />,
            isDriver ? "لا يُستخدم للسائق اليومي" : undefined)}
          {label(isDriver ? "الأجرة اليومية *" : "الأجرة اليومية", "dailyWage",
            <input aria-label="الأجرة اليومية" className={cn(field, err("dailyWage"), isStaff && !v.dailyWage && "opacity-50")} dir="ltr" inputMode="decimal" disabled={isStaff && !v.dailyWage} value={v.dailyWage} onChange={(e) => set({ dailyWage: e.target.value })} />,
            isStaff ? "تُحسب من الراتب للموظف" : undefined)}
          {label("تاريخ التعيين", "hireDate", <div className={cn("rounded border border-line px-2 py-1", err("hireDate"))}><DateField ariaLabel="تاريخ التعيين" value={v.hireDate} onChange={(d) => set({ hireDate: d })} /></div>)}
          {label("تاريخ انتهاء الخدمة", "endDate", <div className={cn("rounded border border-line px-2 py-1", err("endDate"))}><DateField ariaLabel="تاريخ انتهاء الخدمة" value={v.endDate} onChange={(d) => set({ endDate: d })} /></div>, "اتركه فارغًا ما دام على رأس العمل")}
          {label("إجازات مسحوبة قبل النظام", "leavesBeforeSystem", <input aria-label="إجازات مسحوبة قبل النظام" className={cn(field, err("leavesBeforeSystem"))} dir="ltr" inputMode="decimal" value={v.leavesBeforeSystem} onChange={(e) => set({ leavesBeforeSystem: e.target.value })} />)}
          {label("رصيد الإجازة السنوي", "annualLeave", <input aria-label="رصيد الإجازة السنوي" className={cn(field, err("annualLeave"))} dir="ltr" inputMode="numeric" placeholder={`${defaultLeave} (الافتراضي)`} value={v.annualLeave} onChange={(e) => set({ annualLeave: e.target.value })} />, "فارغ = رصيد الإعدادات")}
          {label("رصيد إجازة مُرحّل (افتتاحي)", "leaveOpeningBalance", <input aria-label="رصيد إجازة مُرحّل" className={cn(field, err("leaveOpeningBalance"))} dir="ltr" inputMode="decimal" value={v.leaveOpeningBalance ?? ""} onChange={(e) => set({ leaveOpeningBalance: e.target.value })} />, "الأيام المتبقية للموظف من قبل أول سنة مسجّلة")}
          <div className="sm:col-span-2">
            {label("ملاحظات", "notes", <textarea aria-label="ملاحظات" rows={2} className={cn(field, err("notes"))} value={v.notes} onChange={(e) => set({ notes: e.target.value })} />)}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
          <button type="button" onClick={onClose} disabled={pending} className="rounded border border-line px-4 py-1.5 text-sm hover:border-gold">إلغاء</button>
          <button type="submit" disabled={pending} className="rounded bg-navy px-5 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
            {pending ? "جارٍ الحفظ…" : id ? "حفظ التعديلات" : "إضافة الموظف"}
          </button>
        </div>
      </form>
    </div>
  );
}
