"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Combobox, type ComboOption } from "@/components/combobox";
import { MonthPicker } from "@/components/month-picker";

export function PayslipControls({ ym, employees, empId }: { ym: string; employees: ComboOption[]; empId: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const go = (emp: string) => {
    const p = new URLSearchParams(sp.toString());
    p.set("emp", emp);
    router.push(`${path}?${p}`);
  };
  return (
    <div className="no-print mb-3 flex flex-wrap items-center gap-4 rounded-lg border border-line bg-white px-4 py-2">
      <MonthPicker ym={ym} extra={{ emp: empId }} />
      <span className="text-sm font-semibold">الموظف</span>
      <div className="min-w-64 rounded border-2 border-gold bg-cream px-2 py-1">
        <Combobox ariaLabel="الموظف" options={[{ value: "all", label: "كل العاملين (قسيمة لكل موظف)" }, ...employees]} value={empId} onChange={go} />
      </div>
    </div>
  );
}
