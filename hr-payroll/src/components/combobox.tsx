"use client";
import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export interface ComboOption {
  value: string;
  label: string;
}

/** قائمة منسدلة بالأسماء الموجودة فقط، مع بحث. */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = "▼ اختر",
  disabled,
  className,
  ariaLabel,
}: {
  options: ComboOption[];
  value: string | null | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <Popover.Root open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn("flex w-full min-w-40 items-center justify-between gap-2 text-right text-[#0000FF] disabled:text-slate-500", className)}
        >
          <span className={cn("truncate", !selected && "text-slate-400")}>{selected?.label ?? placeholder}</span>
          {!disabled && <ChevronDown size={14} className="shrink-0 text-gold" />}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={4} className="z-50 w-72 rounded-md border border-gold bg-white shadow-lg" dir="rtl">
          <Command>
            <Command.Input autoFocus placeholder="ابحث…" className="w-full border-b border-line px-3 py-2 text-sm outline-none" />
            <Command.List className="max-h-64 overflow-y-auto p-1">
              <Command.Empty className="px-3 py-2 text-sm text-slate-400">لا نتائج</Command.Empty>
              {options.map((o) => (
                <Command.Item
                  key={o.value}
                  value={o.label + " " + o.value}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className="cursor-pointer rounded px-3 py-1.5 text-sm data-[selected=true]:bg-cream"
                >
                  {o.label}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
