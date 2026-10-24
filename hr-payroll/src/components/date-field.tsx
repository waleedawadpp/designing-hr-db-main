"use client";
import * as Popover from "@radix-ui/react-popover";
import { DayPicker } from "react-day-picker";
import { ar } from "date-fns/locale";
import "react-day-picker/style.css";
import { useState } from "react";
import { formatDate } from "@/lib/payroll";
import { cn } from "@/lib/utils";

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fromISO(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** منتقي تاريخ بصيغة dd/mm/yyyy — لا يقبل ما قبل 01/01/2020. */
export function DateField({
  value,
  onChange,
  disabled,
  clearable = true,
  className,
  ariaLabel,
  defaultMonth,
}: {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
  ariaLabel?: string;
  /** الشهر الذي يُفتح عليه المنتقي عند خلو الحقل (YYYY-MM) */
  defaultMonth?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? fromISO(value) : undefined;
  return (
    <Popover.Root open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
      <Popover.Trigger asChild>
        <button type="button" aria-label={ariaLabel} disabled={disabled} className={cn("w-full min-w-24 text-right text-[#0000FF] disabled:text-slate-500", className)} dir="ltr">
          {value ? formatDate(value) : <span className="text-slate-400">dd/mm/yyyy</span>}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={4} className="z-50 rounded-md border border-gold bg-white p-2 shadow-lg" dir="rtl">
          <DayPicker
            mode="single"
            locale={ar}
            dir="rtl"
            captionLayout="dropdown"
            startMonth={new Date(2020, 0)}
            endMonth={new Date(2060, 11)}
            disabled={{ before: new Date(2020, 0, 1) }}
            selected={selected}
            defaultMonth={selected ?? (defaultMonth ? fromISO(`${defaultMonth}-01`) : undefined)}
            onSelect={(d) => {
              if (d) onChange(toISO(d));
              setOpen(false);
            }}
          />
          {clearable && value && (
            <button type="button" className="mt-1 w-full rounded bg-page py-1 text-sm text-slate-600" onClick={() => { onChange(null); setOpen(false); }}>
              مسح التاريخ
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
