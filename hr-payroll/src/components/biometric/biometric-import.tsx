"use client";
import Link from "next/link";
import { useActionState, useMemo, useState, useTransition } from "react";
import { CheckCircle2, Fingerprint, Upload } from "lucide-react";
import { applyPunchLog, loadPunchLog, type ApplyResult, type LoadState } from "@/app/(app)/biometric/actions";
import { planEmployee, selectedByDefault, type PlanCell } from "@/lib/biometric";
import { CODES, formatDate, formatMonth, weekdayOf } from "@/lib/payroll";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
/** قيمة الخانة في القائمة: "" = بلا تغيير، "x" = تفريغ، وإلا رمز */
type Choice = string;
const CLEAR = "x";

export function BiometricImport() {
  const [state, action, pending] = useActionState<LoadState, FormData>(loadPunchLog, {});
  return (
    <div className="space-y-4">
      <form action={action} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white p-4">
        <input type="file" name="file" accept=".xls,.xlsx" required className="text-sm" aria-label="ملف تقرير البصمة" />
        <button disabled={pending} className="flex items-center gap-1 rounded bg-navy px-4 py-1.5 text-sm text-white disabled:opacity-50">
          <Upload size={16} color="#C9A227" /> {pending ? "جاري القراءة…" : "قراءة التقرير"}
        </button>
        <span className="text-xs text-slate-500">من برنامج البصمة: تقرير «سجل الحركات / Attendance Log» بصيغة Excel</span>
      </form>
      {state.error && (
        <div role="alert" className="rounded border border-[#B91C1C] bg-[#FEE2E2] px-3 py-2 text-sm font-semibold text-[#B91C1C]">
          {state.error}
        </div>
      )}
      {state.log && <Preview key={`${state.fileName}|${state.log.punches}|${state.log.start}`} state={state as Required<LoadState>} />}
    </div>
  );
}

function Preview({ state }: { state: Required<LoadState> }) {
  const { log, employees, current, weeklyOffDay, closed } = state;
  const empById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const [mapping, setMapping] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const d of log.employees) m[d.deviceId] = employees.find((e) => e.deviceId === d.deviceId)?.id ?? "";
    return m;
  });
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [saving, startSaving] = useTransition();

  const rows = useMemo(
    () =>
      log.employees
        .filter((d) => mapping[d.deviceId])
        .map((d) => {
          const emp = empById.get(mapping[d.deviceId])!;
          return { device: d, emp, cells: planEmployee(emp, d.days, current[emp.id] ?? {}, log.start, log.end, weeklyOffDay) };
        }),
    [log, mapping, empById, current, weeklyOffDay],
  );
  const dates = rows[0]?.cells.map((c) => c.date) ?? [];
  const isClosed = (date: string) => closed.includes(date.slice(0, 7));

  const keyOf = (empId: string, date: string) => `${empId}|${date}`;
  const choiceOf = (empId: string, cell: PlanCell): Choice => {
    const k = keyOf(empId, cell.date);
    if (k in choices) return choices[k];
    return selectedByDefault(cell) && cell.proposed ? cell.proposed : "";
  };
  /** الرمز الذي سيُحفظ، أو undefined إن لم يتغير شيء */
  const finalOf = (empId: string, cell: PlanCell): string | null | undefined => {
    const c = choiceOf(empId, cell);
    if (c === "") return undefined;
    const code = c === CLEAR ? null : c;
    return code === cell.current ? undefined : code;
  };

  const changes = rows.flatMap((r) =>
    r.cells
      .filter((c) => c.kind !== "inactive" && !isClosed(c.date))
      .flatMap((c) => {
        const code = finalOf(r.emp.id, c);
        return code === undefined ? [] : [{ employeeId: r.emp.id, date: c.date, code }];
      }),
  );
  const overwrites = rows.flatMap((r) => r.cells.filter((c) => c.kind === "overwrite" && !isClosed(c.date)).map((c) => ({ r, c })));
  const allOverwritesOn = overwrites.length > 0 && overwrites.every(({ r, c }) => choiceOf(r.emp.id, c) === c.proposed);

  const usedIds = new Set(Object.values(mapping).filter(Boolean));
  const unmappedDevices = log.employees.filter((d) => !mapping[d.deviceId]);
  const withoutDevice = employees.filter((e) => !usedIds.has(e.id) && (!e.endDate || e.endDate >= log.start) && (!e.hireDate || e.hireDate <= log.end));

  function toggleOverwrites() {
    setChoices((prev) => {
      const next = { ...prev };
      for (const { r, c } of overwrites) next[keyOf(r.emp.id, c.date)] = allOverwritesOn ? "" : (c.proposed ?? "");
      return next;
    });
  }

  function save() {
    setResult(null);
    startSaving(async () => setResult(await applyPunchLog({ mapping, changes })));
  }

  if (result?.ok) {
    return (
      <div className="space-y-2 rounded-lg border border-[#166534]/30 bg-[#DCFCE7] p-4 text-sm text-[#166534]" data-testid="bio-result">
        <div className="flex items-center gap-2 font-semibold">
          <CheckCircle2 size={18} /> تم الاعتماد: {result.changed} خانة حضور، و{result.linked} ربط جديد بأرقام الجهاز.
        </div>
        <div>
          راجع وعدّل من{" "}
          {result.months.map((m, i) => (
            <span key={m}>
              {i > 0 && "، "}
              <Link href={`/attendance?month=${m}`} className="font-semibold underline">
                إدخال الحضور — {formatMonth(m)}
              </Link>
            </span>
          ))}
          {result.months.length === 0 && (
            <Link href="/attendance" className="font-semibold underline">
              إدخال الحضور
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-line bg-white p-3 text-sm">
        <b>{state.fileName}</b> — {log.punches} بصمة لـ {log.employees.length} رقمًا في الجهاز، من {formatDate(log.start)} إلى {formatDate(log.end)}.
        {closed.length > 0 && (
          <div className="mt-1 font-semibold text-[#B91C1C]">شهر {closed.map(formatMonth).join("، ")} معتمد ومقفل — أيامه لن تُعدّل.</div>
        )}
      </div>

      <section className="rounded-lg border border-line bg-white">
        <h2 className="flex items-center gap-2 border-b border-line px-4 py-2 font-bold text-navy">
          <Fingerprint size={18} color="#C9A227" /> ١) ربط أرقام الجهاز بالموظفين
          <span className="text-xs font-normal text-slate-500">يُحفظ مرة واحدة ويُستخدم تلقائيًا في كل تقرير بعدها</span>
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream text-right text-xs text-slate-600">
              <tr>
                <th className="px-3 py-1.5">رقم الجهاز</th>
                <th className="px-3 py-1.5">الاسم في الجهاز</th>
                <th className="px-3 py-1.5">أيام فيها بصمة</th>
                <th className="px-3 py-1.5">الموظف في النظام</th>
              </tr>
            </thead>
            <tbody>
              {log.employees.map((d) => (
                <tr key={d.deviceId} className={cn("border-t border-line", !mapping[d.deviceId] && "bg-[#FEF9C3]")}>
                  <td className="px-3 py-1.5 font-mono">{d.deviceId}</td>
                  <td className="px-3 py-1.5" dir="ltr">
                    {d.deviceName}
                  </td>
                  <td className="px-3 py-1.5">{Object.keys(d.days).length}</td>
                  <td className="px-3 py-1">
                    <select
                      aria-label={`الموظف لرقم ${d.deviceId}`}
                      value={mapping[d.deviceId]}
                      onChange={(e) => setMapping({ ...mapping, [d.deviceId]: e.target.value })}
                      className="w-full min-w-48 rounded border border-line px-2 py-1"
                    >
                      <option value="">— بلا ربط (تُتجاهل بصماته) —</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id} disabled={usedIds.has(e.id) && mapping[d.deviceId] !== e.id}>
                          {e.code} — {e.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {unmappedDevices.length > 0 && (
          <div className="border-t border-line px-4 py-2 text-xs text-[#854D0E]">{unmappedDevices.length} رقمًا بلا ربط (بالأصفر) — اختر الموظف المقابل لكل رقم.</div>
        )}
        {withoutDevice.length > 0 && (
          <div className="border-t border-line px-4 py-2 text-xs text-slate-600">
            موظفون ليس لهم بصمة في هذا التقرير (لن يُغيَّر حضورهم): {withoutDevice.map((e) => e.name).join("، ")}
          </div>
        )}
      </section>

      {rows.length > 0 && (
        <section className="rounded-lg border border-line bg-white">
          <h2 className="border-b border-line px-4 py-2 font-bold text-navy">٢) معاينة الحضور وتعديله</h2>
          <div className="flex flex-wrap items-center gap-3 px-4 py-2 text-xs">
            <Legend cls="bg-[#DCFCE7] text-[#166534]" label="سيُسجَّل (خانة فارغة)" />
            <Legend cls="bg-[#FEF3C7] text-[#92400E] ring-1 ring-[#F59E0B]" label="يغيّر رمزًا موجودًا" />
            <Legend cls="border border-dashed border-[#F59E0B]" label="اقتراح مختلف عن الموجود (غير محدد)" />
            <Legend cls="bg-slate-100 text-slate-500" label="بلا تغيير / عطلة" />
            {overwrites.length > 0 && (
              <button type="button" onClick={toggleOverwrites} className="rounded border border-line px-2 py-1 hover:bg-cream">
                {allOverwritesOn ? "إلغاء كل الاستبدالات" : `تطبيق كل الاستبدالات المقترحة (${overwrites.length})`}
              </button>
            )}
          </div>
          <p className="px-4 pb-2 text-xs text-slate-500">مرّر المؤشر على الخانة لترى أوقات البصمات. غيّر أي خانة من القائمة قبل الاعتماد.</p>
          <div className="overflow-x-auto">
            <table className="border-collapse text-xs">
              <thead className="bg-navy text-white">
                <tr>
                  <th className="sticky right-0 z-10 min-w-40 bg-navy px-2 py-1 text-right">الموظف</th>
                  {dates.map((d) => (
                    <th key={d} className={cn("px-0.5 py-1 text-center font-normal", weekdayOf(d) === weeklyOffDay && "bg-[#334155]")}>
                      <div className="font-bold">{Number(d.slice(8))}</div>
                      <div className="text-[10px] opacity-80">{WEEKDAYS[weekdayOf(d)]}</div>
                    </th>
                  ))}
                  <th className="px-2 py-1">ح</th>
                  <th className="px-2 py-1">غ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ emp, cells }) => {
                  let h = 0;
                  let g = 0;
                  return (
                    <tr key={emp.id} className="border-t border-line">
                      <td className="sticky right-0 z-10 bg-white px-2 py-1 font-semibold">
                        {emp.name}
                        <div className="text-[10px] font-normal text-slate-500">{emp.code}</div>
                      </td>
                      {cells.map((c) => {
                        const locked = c.kind === "inactive" || isClosed(c.date);
                        const fin = locked ? undefined : finalOf(emp.id, c);
                        const shown = fin === undefined ? c.current : fin;
                        if (shown === "ح") h++;
                        if (shown === "غ") g++;
                        const title = [
                          formatDate(c.date),
                          c.times.length ? `البصمات: ${c.times.join("، ")}` : "لا بصمة",
                          `الموجود: ${c.current ?? "فارغ"}`,
                          c.proposed && c.proposed !== c.current ? `المقترح: ${c.proposed}` : "",
                        ]
                          .filter(Boolean)
                          .join("\n");
                        if (locked)
                          return (
                            <td key={c.date} title={title} className="bg-slate-100 px-0.5 py-1 text-center text-slate-400">
                              {c.current ?? "—"}
                            </td>
                          );
                        const pendingSuggestion = fin === undefined && c.kind === "overwrite";
                        return (
                          <td key={c.date} className="px-0.5 py-0.5 text-center">
                            <select
                              title={title}
                              aria-label={`${emp.name} ${formatDate(c.date)}`}
                              value={choiceOf(emp.id, c)}
                              onChange={(e) => setChoices({ ...choices, [keyOf(emp.id, c.date)]: e.target.value })}
                              className={cn(
                                "h-7 w-10 cursor-pointer appearance-none rounded text-center font-bold",
                                fin !== undefined
                                  ? c.current
                                    ? "bg-[#FEF3C7] text-[#92400E] ring-1 ring-[#F59E0B]"
                                    : "bg-[#DCFCE7] text-[#166534]"
                                  : pendingSuggestion
                                    ? "border border-dashed border-[#F59E0B] bg-white"
                                    : "bg-slate-100 text-slate-500",
                              )}
                            >
                              <option value="">{c.current ?? "·"}</option>
                              {CODES.filter((k) => k !== c.current).map((k) => (
                                <option key={k} value={k}>
                                  {k}
                                </option>
                              ))}
                              {c.current && <option value={CLEAR}>تفريغ</option>}
                            </select>
                          </td>
                        );
                      })}
                      <td className="px-2 text-center font-semibold text-[#166534]">{h}</td>
                      <td className="px-2 text-center font-semibold text-[#B91C1C]">{g}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {result && !result.ok && (
        <div role="alert" className="rounded border border-[#B91C1C] bg-[#FEE2E2] px-3 py-2 text-sm font-semibold text-[#B91C1C]">
          {result.error}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || (changes.length === 0 && !mappingChanged(mapping, log, employees))}
          className="flex items-center gap-1 rounded bg-navy px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <CheckCircle2 size={16} color="#C9A227" /> {saving ? "جاري الحفظ…" : `اعتماد (${changes.length} تغيير)`}
        </button>
        <span className="text-xs text-slate-500">يُحفظ كل تغيير في سجل التدقيق، ويمكن تعديله لاحقًا من «إدخال الحضور».</span>
      </div>
    </div>
  );
}

function mappingChanged(mapping: Record<string, string>, log: Required<LoadState>["log"], employees: Required<LoadState>["employees"]) {
  return log.employees.some((d) => (employees.find((e) => e.deviceId === d.deviceId)?.id ?? "") !== mapping[d.deviceId]);
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn("inline-block h-4 w-6 rounded", cls)} />
      {label}
    </span>
  );
}
