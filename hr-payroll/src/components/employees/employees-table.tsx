"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DateField } from "@/components/date-field";
import { EMP_TYPES, employeeStatus } from "@/lib/payroll";
import { saveEmployee, type EmployeeInput } from "@/app/(app)/employees/actions";
import { cn } from "@/lib/utils";

type Row = EmployeeInput & { id: string | null; key: string };
type Errors = Partial<Record<keyof EmployeeInput, string>>;

const blank = (): Row => ({
  id: null,
  key: `new-${Math.random().toString(36).slice(2)}`,
  code: "", name: "", type: "", monthlySalary: "", dailyWage: "", dailyHours: "9",
  hireDate: null, endDate: null, leavesBeforeSystem: "", notes: "",
});

function isBlank(r: Row) {
  return !r.code && !r.name && !r.type && !r.monthlySalary && !r.dailyWage && !r.hireDate && !r.endDate && !r.leavesBeforeSystem && !r.notes;
}

export function EmployeesTable({ rows: initial, canEdit, today }: { rows: (EmployeeInput & { id: string })[]; canEdit: boolean; today: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => [...initial.map((r) => ({ ...r, key: r.id })), ...(canEdit ? [blank()] : [])]);
  const [errors, setErrors] = useState<Record<string, Errors>>({});
  const [saved, setSaved] = useState<string | null>(null);
  const saving = useRef(new Set<string>());
  const snapshot = useRef(new Map(initial.map((r) => [r.id, JSON.stringify(r)])));

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(null), 2500);
    return () => clearTimeout(t);
  }, [saved]);

  function update(key: string, patch: Partial<Row>, commit = false) {
    const cur = rows.find((r) => r.key === key);
    if (!cur) return;
    const next = { ...cur, ...patch };
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    if (commit) persist(next);
  }

  async function persist(row: Row) {
    if (!canEdit || saving.current.has(row.key)) return;
    if (!row.id && isBlank(row)) return;
    const { id, key, ...input } = row;
    if (id && snapshot.current.get(id) === JSON.stringify({ id, ...input })) return;
    // السطر الجديد يُحفظ بعد كتابة الرقم والاسم والنوع على الأقل
    if (!id && (!input.code || !input.name || !input.type)) return;
    saving.current.add(key);
    const res = await saveEmployee(id, input);
    saving.current.delete(key);
    if (!res.ok) {
      setErrors((e) => ({ ...e, [key]: res.errors }));
      return;
    }
    setErrors((e) => ({ ...e, [key]: {} }));
    snapshot.current.set(res.id, JSON.stringify({ id: res.id, ...input }));
    setSaved(input.name);
    if (!id) {
      setRows((rs) => [...rs.map((r) => (r.key === key ? { ...r, id: res.id } : r)), blank()]);
    }
    router.refresh();
  }

  const cell = (r: Row, f: keyof EmployeeInput, opts: { num?: boolean; width?: string; disabled?: boolean } = {}) => {
    const err = errors[r.key]?.[f];
    return (
      <td className={cn("!py-0", opts.width, err && "!bg-[#FEE2E2]", opts.disabled && "calc")} title={err}>
        <input
          aria-label={f}
          className={cn("inp py-1", opts.num && "text-left")}
          dir={opts.num ? "ltr" : undefined}
          inputMode={opts.num ? "decimal" : undefined}
          value={r[f] as string}
          readOnly={!canEdit || opts.disabled}
          onChange={(e) => update(r.key, { [f]: e.target.value } as Partial<Row>)}
          onBlur={() => persist(rows.find((x) => x.key === r.key)!)}
        />
        {err && <div className="pb-0.5 text-[11px] text-[#B91C1C]">{err}</div>}
      </td>
    );
  };

  return (
    <div>
      <div className="mb-2 h-5 text-sm" aria-live="polite">{saved && <span className="text-[#166534]">✔ تم الحفظ — {saved}</span>}</div>
      <div className="overflow-auto rounded-lg border border-line bg-white">
        <table className="tbl w-full" data-testid="employees-table">
          <thead>
            <tr>
              <th>الرقم</th><th>الاسم</th><th>النوع</th><th>الراتب الشهري</th><th>الأجرة اليومية</th><th>ساعات الدوام اليومي</th>
              <th>تاريخ التعيين</th><th>تاريخ انتهاء الخدمة</th><th>إجازات مسحوبة قبل النظام</th><th className="th-total">الحالة</th><th>ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const err = errors[r.key] ?? {};
              const isDriver = r.type === "سائق يومي";
              return (
                <tr key={r.key} data-testid={r.id ? `emp-${r.code}` : "emp-new"}>
                  {cell(r, "code", { width: "min-w-[90px]" })}
                  {cell(r, "name", { width: "min-w-[200px]" })}
                  <td className={cn("min-w-[120px] !py-0", err.type && "!bg-[#FEE2E2]")}>
                    <select
                      aria-label="type"
                      className="inp py-1"
                      value={r.type}
                      disabled={!canEdit}
                      onChange={(e) => update(r.key, { type: e.target.value }, true)}
                    >
                      <option value="" disabled>▼</option>
                      {EMP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {err.type && <div className="text-[11px] text-[#B91C1C]">{err.type}</div>}
                  </td>
                  {cell(r, "monthlySalary", { num: true, width: "min-w-[100px]", disabled: isDriver && !r.monthlySalary })}
                  {cell(r, "dailyWage", { num: true, width: "min-w-[90px]", disabled: r.type === "موظف" && !r.dailyWage })}
                  {cell(r, "dailyHours", { num: true, width: "min-w-[70px]" })}
                  <td className={cn("min-w-[110px] !py-0", err.hireDate && "!bg-[#FEE2E2]")}>
                    <DateField ariaLabel="hireDate" value={r.hireDate} disabled={!canEdit} onChange={(v) => update(r.key, { hireDate: v }, true)} />
                    {err.hireDate && <div className="text-[11px] text-[#B91C1C]">{err.hireDate}</div>}
                  </td>
                  <td className={cn("min-w-[110px] !py-0", err.endDate && "!bg-[#FEE2E2]")}>
                    <DateField ariaLabel="endDate" value={r.endDate} disabled={!canEdit} onChange={(v) => update(r.key, { endDate: v }, true)} />
                    {err.endDate && <div className="text-[11px] text-[#B91C1C]">{err.endDate}</div>}
                  </td>
                  {cell(r, "leavesBeforeSystem", { num: true, width: "min-w-[80px]" })}
                  <td className={cn("calc", r.id && employeeStatus(r, today) === "انتهت الخدمة" && "!text-[#B91C1C]")}>
                    {r.name ? employeeStatus(r, today) : ""}
                  </td>
                  {cell(r, "notes", { width: "min-w-[160px]" })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
