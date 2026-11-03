"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { EmployeeDialog } from "@/components/employees/employee-dialog";
import type { EmployeeInput } from "@/app/(app)/employees/actions";

export function EmployeeEditButton({ id, initial, defaultLeave }: { id: string; initial: EmployeeInput; defaultLeave: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1 rounded border border-gold bg-cream px-3 py-1 text-sm text-navy">
        <Pencil size={14} /> تعديل البيانات
      </button>
      {open && (
        <EmployeeDialog id={id} initial={initial} defaultLeave={defaultLeave} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); router.refresh(); }} />
      )}
    </>
  );
}
