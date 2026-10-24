"use client";
import { useRouter } from "next/navigation";
import { Combobox, type ComboOption } from "@/components/combobox";
import { YEARS } from "@/lib/utils";

export function LeaveControls({ employees, empId, year }: { employees: ComboOption[]; empId: string; year: number }) {
  const router = useRouter();
  const go = (e: string, y: number) => router.push(`/leave-form?emp=${e}&y=${y}`);
  return (
    <>
      <div className="min-w-64 rounded border-2 border-gold bg-cream px-2 py-1">
        <Combobox ariaLabel="اسم الموظف" options={employees} value={empId} onChange={(v) => go(v, year)} placeholder="▼ اختر الموظف" />
      </div>
      <label className="no-print text-sm font-semibold">السنة</label>
      <select aria-label="السنة" className="select-cream no-print" value={year} onChange={(e) => go(empId, Number(e.target.value))}>
        {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <span className="hidden print:inline">السنة: {year}</span>
    </>
  );
}
