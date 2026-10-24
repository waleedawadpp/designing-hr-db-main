import type { ReactNode } from "react";

/** شريط عنوان كحلي ثم سطر شرح كريمي. */
export function PageHeader({ title, hint, actions }: { title: ReactNode; hint?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-line shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-gold bg-navy px-4 py-3 text-white">
        <h1 className="text-lg font-bold">{title}</h1>
        {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {hint && <div className="bg-cream px-4 py-2 text-sm text-slate-700">{hint}</div>}
    </div>
  );
}
