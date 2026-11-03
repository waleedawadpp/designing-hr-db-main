"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, LockOpen } from "lucide-react";
import { closeMonth, reopenMonth } from "@/app/(app)/monthly/actions";

/** حالة اعتماد الشهر مع زر الاعتماد / إعادة الفتح للمدير. */
export function MonthCloseBar({
  ym,
  label,
  closed,
  canEdit,
  negatives,
}: {
  ym: string;
  label: string;
  closed?: { at: string; by: string };
  canEdit: boolean;
  negatives: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, confirmText: string) {
    if (!confirm(confirmText)) return;
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "تعذّر التنفيذ");
      else {
        setError(null);
        router.refresh();
      }
    });
  }

  const at = closed ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Muscat", dateStyle: "short", timeStyle: "short" }).format(new Date(closed.at)) : "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {closed ? (
        <span className="flex items-center gap-1 rounded-full bg-[#DCFCE7] px-3 py-1 text-sm font-semibold text-[#166534]" data-testid="month-status">
          <Lock size={14} /> معتمد ومقفل — {at} ({closed.by})
        </span>
      ) : (
        <span className="rounded-full bg-cream px-3 py-1 text-sm font-semibold text-[#B45309] ring-1 ring-gold" data-testid="month-status">
          مفتوح للتعديل
        </span>
      )}
      {canEdit && !closed && (
        <button
          disabled={pending}
          onClick={() =>
            run(
              () => closeMonth(ym),
              `اعتماد شهر ${label}؟\nستُحفظ الرواتب كما هي الآن، ولن يمكن تعديل حضور أو إضافي أو خصومات هذا الشهر حتى يُعاد فتحه.` +
                (negatives ? `\n\n⚠ تنبيه: ${negatives} موظف صافيهم بالسالب.` : ""),
            )
          }
          className="flex items-center gap-1 rounded bg-navy px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          <Lock size={14} color="#C9A227" /> اعتماد الشهر
        </button>
      )}
      {canEdit && closed && (
        <button
          disabled={pending}
          onClick={() => run(() => reopenMonth(ym), `إعادة فتح شهر ${label} للتعديل؟ ستُحسب الرواتب من جديد من البيانات الحالية.`)}
          className="flex items-center gap-1 rounded border border-line bg-white px-3 py-1 text-sm text-slate-700 disabled:opacity-50"
        >
          <LockOpen size={14} /> إعادة فتح
        </button>
      )}
      {error && <span role="alert" className="text-sm font-semibold text-[#B91C1C]">{error}</span>}
    </div>
  );
}
