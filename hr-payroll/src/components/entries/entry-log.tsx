"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Combobox, type ComboOption } from "@/components/combobox";
import { DateField } from "@/components/date-field";
import { MonthPicker } from "@/components/month-picker";
import { DEDUCTION_ITEMS, EXTRA_ITEMS, fmtNumber3, type LinkStatus } from "@/lib/payroll";
import { saveEntry, softDeleteEntry, type EntryKind, type EntryPatch } from "@/app/(app)/entries-actions";
import type { DeductionView, ExtraView } from "@/lib/entries";
import { cn, currentMonthKey } from "@/lib/utils";

type View = ExtraView | DeductionView;

const n3 = (v: number | null | undefined) => (v == null ? "" : fmtNumber3(v));
const n2 = (v: number | null | undefined) => (v == null ? "" : v.toFixed(2));
const s = (v: number | null | undefined) => (v == null ? "" : String(v));

function StatusCell({ status, warning }: { status: LinkStatus; warning?: string | null }) {
  if (status.kind === "empty") return <td className="calc" />;
  const ok = status.kind === "linked";
  return (
    <td className={cn("min-w-[200px] !whitespace-normal !text-xs font-semibold", ok ? "!bg-[#DCFCE7] !text-[#166534]" : "!bg-[#FEE2E2] !text-[#B91C1C]")} data-testid="link-status">
      {status.text}
      {warning && <div className="mt-0.5 rounded bg-[#FEF3C7] px-1 text-[#B45309]">{warning}</div>}
    </td>
  );
}

export function EntryLog({
  kind,
  ym,
  page,
  pageCount,
  total,
  unlinked,
  rows,
  employees,
  canEdit,
  closedMonths,
}: {
  kind: EntryKind;
  ym: string;
  page: number;
  pageCount: number;
  total: number;
  unlinked: number;
  rows: View[];
  employees: ComboOption[];
  canEdit: boolean;
  closedMonths: string[];
}) {
  const router = useRouter();
  const path = usePathname();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [draftKey, setDraftKey] = useState(0);
  const [, startTransition] = useTransition();
  const isExtra = kind === "extra";

  async function commit(id: string | null, patch: EntryPatch) {
    if (!canEdit) return;
    setSaved(false);
    const res = await saveEntry(kind, id, patch);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError(null);
    setSaved(true);
    if (!id) setDraftKey((k) => k + 1);
    startTransition(() => router.refresh());
  }

  async function remove(id: string) {
    if (!confirm("حذف هذا السطر؟ (يبقى محفوظًا في السجل التاريخي)")) return;
    const res = await softDeleteEntry(kind, id);
    if (!res.ok) setError(res.error);
    else startTransition(() => router.refresh());
  }

  const monthForPicker = ym === "all" ? currentMonthKey() : ym;
  const all: (View | null)[] = canEdit ? [...rows, null] : rows;

  return (
    <div className="space-y-3">
      <div className="no-print flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white px-3 py-2">
        <MonthPicker ym={monthForPicker} extra={{ all: undefined }} />
        <Link href={`${path}?all=1`} className={cn("rounded px-3 py-1 text-sm ring-1 ring-gold", ym === "all" ? "bg-gold text-navy" : "bg-cream")}>
          كل الأشهر
        </Link>
        <span className="text-sm text-slate-500">{total} سطر</span>
        <span
          className={cn("rounded-full px-3 py-0.5 text-sm font-semibold", unlinked ? "bg-[#FEE2E2] text-[#B91C1C]" : "bg-[#DCFCE7] text-[#166534]")}
          data-testid="unlinked-badge"
        >
          {unlinked ? `⚠ ${unlinked} سطر غير مربوط` : "✔ كل الأسطر مربوطة"}
        </span>
        <span className="ms-auto text-sm" aria-live="polite">{saved && <span className="text-[#166534]">✔ تم الحفظ</span>}</span>
      </div>
      {ym !== "all" && closedMonths.includes(ym) && (
        <div className="rounded border border-[#166534]/30 bg-[#DCFCE7] px-3 py-2 text-sm font-semibold text-[#166534]">
          🔒 شهر {ym.slice(5)}/{ym.slice(0, 4)} معتمد ومقفل — أسطره للقراءة فقط.
        </div>
      )}
      {error && <div role="alert" className="rounded border border-[#B91C1C] bg-[#FEE2E2] px-3 py-2 text-sm font-semibold text-[#B91C1C]">{error}</div>}

      <div className="overflow-auto rounded-lg border border-line bg-white">
        <table className="tbl w-full [&_th]:whitespace-normal" data-testid={`${kind}-table`}>
          <thead>
            {isExtra ? (
              <tr>
                <th>التاريخ</th><th>الاسم</th><th>البند</th><th>الوقت الفعلي (س.د)</th>
                <th className="th-total">الساعات بالعشري</th><th className="th-total">الساعات المحتسبة ×1.5</th><th className="th-total">أجرة الساعة</th>
                <th>مبلغ المكافأة</th><th className="th-total">المبلغ المستحق</th><th className="th-total">الرقم</th><th>ملاحظات</th><th className="th-total">حالة الربط</th>
                {canEdit && <th className="no-print" />}
              </tr>
            ) : (
              <tr>
                <th>التاريخ</th><th>الاسم</th><th>البند</th><th>دقائق التأخير</th><th className="th-total">تكلفة الدقيقة</th>
                <th>مبلغ الغرامة / الخصم</th><th className="th-total">المبلغ المخصوم</th><th className="th-total">الرقم</th><th>ملاحظات</th><th className="th-total">حالة الربط</th>
                {canEdit && <th className="no-print" />}
              </tr>
            )}
          </thead>
          <tbody>
            {all.map((v) => (
              <EntryRow
                key={v?.id ?? `draft-${draftKey}`}
                kind={kind}
                ym={ym === "all" ? undefined : ym}
                v={v}
                employees={employees}
                canEdit={canEdit && !(v?.date && closedMonths.includes(v.date.slice(0, 7)))}
                onCommit={commit}
                onDelete={remove}
              />
            ))}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <div className="no-print flex items-center gap-1 text-sm">
          الصفحات:
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => {
            const q = new URLSearchParams(ym === "all" ? { all: "1" } : { y: ym.slice(0, 4), m: String(+ym.slice(5)) });
            q.set("page", String(p));
            return (
              <Link key={p} href={`${path}?${q}`} className={cn("rounded px-2 ring-1 ring-line", p === page && "bg-navy text-white")}>{p}</Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EntryRow({
  kind,
  ym,
  v,
  employees,
  canEdit,
  onCommit,
  onDelete,
}: {
  kind: EntryKind;
  ym?: string;
  v: View | null;
  employees: ComboOption[];
  canEdit: boolean;
  onCommit: (id: string | null, p: EntryPatch) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const id = v?.id ?? null;
  const [local, setLocal] = useState<{ date?: string | null; employeeId?: string | null; item?: string | null }>({});
  const date = local.date !== undefined ? local.date : v?.date ?? null;
  const employeeId = local.employeeId !== undefined ? local.employeeId : v?.employeeId ?? null;
  const item = local.item !== undefined ? local.item : v?.item ?? null;
  const opts = v?.employeeId && !employees.some((e) => e.value === v.employeeId) ? [...employees, { value: v.employeeId, label: v.name ?? "" }] : employees;
  const unknownName = v && !v.employeeId && v.name;

  const set = (patch: EntryPatch & { date?: string | null; employeeId?: string | null; item?: string | null }) => {
    setLocal((l) => ({ ...l, ...patch }));
    void onCommit(id, patch);
  };

  const numInput = (field: keyof EntryPatch, value: number | null | undefined, label: string, show: boolean) => (
    <td className={cn("!py-0", !show && "calc")}>
      {show && (
        <input
          aria-label={label}
          className="inp py-1 text-left"
          dir="ltr"
          inputMode="decimal"
          defaultValue={s(value)}
          readOnly={!canEdit}
          onBlur={(e) => {
            if (e.target.value.trim() !== s(value)) void onCommit(id, { [field]: e.target.value });
          }}
        />
      )}
    </td>
  );

  const nameCell = (
    <td className="!py-0">
      {unknownName ? (
        <div className="flex items-center gap-1">
          <span className="text-[#B91C1C] line-through" title="الاسم غير موجود في بيانات الموظفين">{v!.name}</span>
          {canEdit && <Combobox ariaLabel="الاسم" options={opts} value={null} onChange={(x) => set({ employeeId: x })} placeholder="▼ اختر" />}
        </div>
      ) : (
        <Combobox ariaLabel="الاسم" options={opts} value={employeeId} onChange={(x) => set({ employeeId: x })} disabled={!canEdit} placeholder="▼ اختر الموظف" />
      )}
    </td>
  );

  const items: readonly string[] = kind === "extra" ? EXTRA_ITEMS : DEDUCTION_ITEMS;
  const itemCell = (
    <td className="!py-0">
      <select aria-label="البند" className="inp min-w-28 py-1" value={item ?? ""} disabled={!canEdit} onChange={(e) => set({ item: e.target.value || null })}>
        <option value="">▼</option>
        {items.map((i) => <option key={i} value={i}>{i}</option>)}
      </select>
    </td>
  );

  const dateCell = (
    <td className="!py-0">
      <DateField ariaLabel="التاريخ" value={date} defaultMonth={ym} disabled={!canEdit} onChange={(x) => set({ date: x })} />
    </td>
  );

  const notesCell = (
    <td className="!py-0">
      <input
        aria-label="ملاحظات"
        className="inp min-w-24 py-1"
        defaultValue={v?.notes ?? ""}
        readOnly={!canEdit}
        onBlur={(e) => { if (e.target.value !== (v?.notes ?? "")) void onCommit(id, { notes: e.target.value }); }}
      />
    </td>
  );

  const del = canEdit && (
    <td className="no-print !px-1">
      {id && (
        <button type="button" aria-label="حذف السطر" onClick={() => onDelete(id)} className="text-slate-400 hover:text-[#B91C1C]">
          <Trash2 size={15} />
        </button>
      )}
    </td>
  );

  if (kind === "extra") {
    const x = v as ExtraView | null;
    return (
      <tr data-testid={id ? "entry-row" : "entry-draft"}>
        {dateCell}
        {nameCell}
        {itemCell}
        {numInput("actualTime", x?.actualTime, "الوقت الفعلي", item !== "مكافأة")}
        <td className="calc num">{n2(x?.decimalHours)}</td>
        <td className="calc num">{n2(x?.countedHours)}</td>
        <td className="calc num">{n3(x?.hourlyRate)}</td>
        {numInput("bonusAmount", x?.bonusAmount, "مبلغ المكافأة", item !== "ساعات إضافية")}
        <td className="calc num font-semibold" data-testid="entry-amount">{n3(x?.amount)}</td>
        <td className="calc">{x?.code ?? ""}</td>
        {notesCell}
        {x ? <StatusCell status={x.status} warning={x.warning} /> : <td className="calc" />}
        {del}
      </tr>
    );
  }
  const d = v as DeductionView | null;
  return (
    <tr data-testid={id ? "entry-row" : "entry-draft"}>
      {dateCell}
      {nameCell}
      {itemCell}
      {numInput("lateMinutes", d?.lateMinutes, "دقائق التأخير", item === "تأخير" || !item)}
      <td className="calc num">{d?.minuteCost == null ? "" : d.minuteCost.toFixed(5)}</td>
      {numInput("amount", d?.amount, "المبلغ", item !== "تأخير")}
      <td className="calc num font-semibold" data-testid="entry-amount">{n3(d?.deducted)}</td>
      <td className="calc">{d?.code ?? ""}</td>
      {notesCell}
      {d ? <StatusCell status={d.status} /> : <td className="calc" />}
      {del}
    </tr>
  );
}
