"use client";
import { useActionState } from "react";
import { Upload } from "lucide-react";
import { importExcel, type ImportState } from "@/app/(app)/import/actions";

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importExcel, {});
  return (
    <div className="space-y-3">
      <form action={action} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white p-4">
        <input type="file" name="file" accept=".xlsx" required className="text-sm" aria-label="ملف Excel" />
        <button disabled={pending} className="flex items-center gap-1 rounded bg-navy px-4 py-1.5 text-sm text-white disabled:opacity-50">
          <Upload size={16} color="#C9A227" /> {pending ? "جاري الاستيراد…" : "استيراد"}
        </button>
      </form>
      {state.error && <div role="alert" className="rounded border border-[#B91C1C] bg-[#FEE2E2] px-3 py-2 text-sm font-semibold text-[#B91C1C]">{state.error}</div>}
      {state.lines && (
        <>
          <div className={`rounded px-3 py-2 text-sm font-semibold ${state.ok ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEE2E2] text-[#B91C1C]"}`} data-testid="import-result">
            {state.ok ? "✔ تم الاستيراد وتطابق الصافي مع الإكسل" : "✖ تم الاستيراد لكن توجد فروق مع الإكسل — راجع التفاصيل"}
          </div>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-white p-3 text-xs leading-5">{state.lines.join("\n")}</pre>
        </>
      )}
    </div>
  );
}
