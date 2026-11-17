"use client";
import { Fragment, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarPlus, CheckCheck, UserCheck } from "lucide-react";
import { CODES, INVALID_CODE_MESSAGE, countCodes, daysInMonth, format1, formatMonth, pad2, weekdayOf } from "@/lib/payroll";
import { addNextMonth, fillDayPresent, fillEmployeePresent, setDayCode, setMonthNotes } from "@/app/(app)/attendance/actions";
import { cn } from "@/lib/utils";

export interface GridRow {
  id: string;
  month: string;
  code: string;
  name: string;
  hireDate: string | null;
  endDate: string | null;
  days: (string | null)[]; // 31
  notes: string;
  duplicate: boolean;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function AttendanceGrid({
  rows: initial,
  monthList,
  selected,
  page,
  pageCount,
  weeklyOffDay,
  canEdit,
  nextMonth,
  nextMonthLabel,
  preview,
  closedMonths,
}: {
  rows: GridRow[];
  monthList: string[];
  selected: string;
  page: number;
  pageCount: number;
  weeklyOffDay: number;
  canEdit: boolean;
  nextMonth: string;
  nextMonthLabel: string;
  preview: string[];
  closedMonths: string[];
}) {
  const router = useRouter();
  const path = usePathname();
  const [rows, setRows] = useState(initial);
  const [save, setSave] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ r: number; c: number; x: number; y: number } | null>(null);
  const [focus, setFocus] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [showNew, setShowNew] = useState(false);
  const [pending, startTransition] = useTransition();
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());
  const pendingSaves = useRef(0);

  useEffect(() => setRows(initial), [initial]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const closedSet = new Set(closedMonths);
  const isLocked = useCallback((row: GridRow, c: number) => c + 1 > daysInMonth(+row.month.slice(0, 4), +row.month.slice(5, 7)), []);
  /** الشهر معتمد: السطر للقراءة فقط */
  const rowClosed = (row: GridRow) => closedSet.has(row.month);

  async function run<T extends { ok: boolean; error?: string }>(p: Promise<T>): Promise<T> {
    pendingSaves.current++;
    setSave("saving");
    try {
      const res = await p;
      if (!res.ok) {
        setError(res.error ?? "تعذّر الحفظ");
        setSave("error");
      } else if (--pendingSaves.current === 0) setSave("saved");
      return res;
    } catch (e) {
      pendingSaves.current--;
      setSave("error");
      setError(e instanceof Error ? e.message : "تعذّر الحفظ");
      throw e;
    }
  }

  function setCell(r: number, c: number, code: string | null) {
    const row = rows[r];
    if (!canEdit || !row || isLocked(row, c) || rowClosed(row)) return;
    if (code !== null && !(CODES as readonly string[]).includes(code)) {
      setError(INVALID_CODE_MESSAGE);
      return;
    }
    const prev = row.days[c];
    if (prev === code) return;
    setRows((rs) => rs.map((x, i) => (i === r ? { ...x, days: x.days.map((d, j) => (j === c ? code : d)) } : x)));
    run(setDayCode(row.id, c + 1, code)).then((res) => {
      if (!res.ok) setRows((rs) => rs.map((x, i) => (i === r ? { ...x, days: x.days.map((d, j) => (j === c ? prev : d)) } : x)));
    });
  }

  function move(r: number, c: number) {
    const nr = Math.max(0, Math.min(rows.length - 1, r));
    const nc = Math.max(0, Math.min(30, c));
    setFocus({ r: nr, c: nc });
    cellRefs.current.get(`${nr}-${nc}`)?.focus();
  }

  function onKey(e: React.KeyboardEvent, r: number, c: number) {
    if (e.key === "ArrowLeft") { e.preventDefault(); move(r, c + 1); return; }
    if (e.key === "ArrowRight") { e.preventDefault(); move(r, c - 1); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); move(r + 1, c); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); move(r - 1, c); return; }
    if (e.key === "Escape") { setMenu(null); return; }
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openMenu(e.currentTarget as HTMLElement, r, c); return; }
    if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); setCell(r, c, null); return; }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      setMenu(null);
      if ((CODES as readonly string[]).includes(e.key)) {
        setCell(r, c, e.key);
        move(r, c + 1);
      } else setError(INVALID_CODE_MESSAGE);
    }
  }

  function openMenu(el: HTMLElement, r: number, c: number) {
    if (!canEdit || isLocked(rows[r], c) || rowClosed(rows[r])) return;
    const b = el.getBoundingClientRect();
    const MENU_H = 44, MENU_W = 260;
    // يُفتح فوق الخانة إن لم تتسع الشاشة أسفلها
    const y = b.bottom + 4 + MENU_H > window.innerHeight ? b.top - 4 - MENU_H : b.bottom + 4;
    const x = Math.min(Math.max(b.left + b.width / 2, MENU_W / 2 + 4), window.innerWidth - MENU_W / 2 - 4);
    setMenu({ r, c, x, y });
  }

  function changeMonth(v: string) {
    router.push(`${path}?month=${encodeURIComponent(v)}`);
  }

  const focusedRow = rows[focus.r];
  const singleMonth = selected !== "all" && !closedSet.has(selected) ? selected : null;

  return (
    <div className="space-y-3">
      <div className="no-print flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white px-3 py-2">
        <label className="text-sm font-semibold">الشهر</label>
        <select aria-label="الشهر" className="select-cream" value={selected} onChange={(e) => changeMonth(e.target.value)}>
          {monthList.map((m) => (
            <option key={m} value={m}>{formatMonth(m)}</option>
          ))}
          <option value="all">كل الأشهر</option>
        </select>
        {selected === "all" && pageCount > 1 && (
          <span className="flex items-center gap-1 text-sm">
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => router.push(`${path}?month=all&page=${p}`)} className={cn("rounded px-2 ring-1 ring-line", p === page && "bg-navy text-white")}>{p}</button>
            ))}
          </span>
        )}
        {canEdit && (
          <>
            <span className="mx-1 h-6 w-px bg-line" />
            <button
              disabled={pending || !singleMonth}
              onClick={() => startTransition(async () => { const r = await run(fillDayPresent(singleMonth!, focus.c + 1)); if (r.ok) router.refresh(); })}
              className="flex items-center gap-1 rounded border border-gold bg-cream px-2 py-1 text-sm disabled:opacity-50"
              title="يعبّئ الخانات الفارغة فقط"
            >
              <CheckCheck size={16} color="#C9A227" /> تعبئة الكل حاضر لهذا اليوم ({focus.c + 1})
            </button>
            <button
              disabled={pending || !focusedRow || rowClosed(focusedRow)}
              onClick={() => startTransition(async () => { const r = await run(fillEmployeePresent(focusedRow!.id)); if (r.ok) router.refresh(); })}
              className="flex items-center gap-1 rounded border border-gold bg-cream px-2 py-1 text-sm disabled:opacity-50"
              title="أيام العمل بدون الجمعة — الخانات الفارغة فقط"
            >
              <UserCheck size={16} color="#C9A227" /> تعبئة الموظف حاضر لكل أيام العمل{focusedRow ? ` (${focusedRow.name})` : ""}
            </button>
            <button onClick={() => setShowNew((v) => !v)} className="flex items-center gap-1 rounded bg-navy px-3 py-1 text-sm text-white">
              <CalendarPlus size={16} color="#C9A227" /> إضافة شهر جديد
            </button>
          </>
        )}
        <span className="ms-auto text-sm" aria-live="polite" data-testid="save-state">
          {save === "saving" && <span className="text-slate-500">جاري الحفظ…</span>}
          {save === "saved" && <span className="text-[#166534]">✔ تم الحفظ</span>}
          {save === "error" && <span className="text-[#B91C1C]">✖ لم يُحفظ</span>}
        </span>
      </div>

      {selected !== "all" && closedSet.has(selected) && (
        <div className="flex items-center gap-2 rounded border border-[#166534]/30 bg-[#DCFCE7] px-3 py-2 text-sm font-semibold text-[#166534]">
          🔒 شهر {formatMonth(selected)} معتمد ومقفل — للقراءة فقط. إعادة الفتح من «الكشف الشهري».
        </div>
      )}
      {error && (
        <div role="alert" className="rounded border border-[#B91C1C] bg-[#FEE2E2] px-3 py-2 text-sm font-semibold text-[#B91C1C]">{error}</div>
      )}

      {showNew && canEdit && (
        <div className="rounded-lg border-2 border-gold bg-cream p-3 text-sm">
          <div className="mb-2 font-bold">الشهر التالي: {nextMonthLabel}</div>
          {preview.length ? (
            <>
              <div className="mb-2 text-slate-600">سيُنشأ سطر فارغ لكل من ({preview.length}):</div>
              <div className="mb-3 grid max-h-40 grid-cols-2 gap-x-6 overflow-y-auto md:grid-cols-4">
                {preview.map((p) => <div key={p}>{p}</div>)}
              </div>
              <button
                disabled={pending}
                onClick={() => startTransition(async () => {
                  const r = await run(addNextMonth());
                  if (r.ok) { setShowNew(false); router.push(`${path}?month=${nextMonth}`); router.refresh(); }
                })}
                className="rounded bg-navy px-4 py-1.5 text-white disabled:opacity-50"
              >
                إنشاء صفوف {nextMonthLabel}
              </button>
            </>
          ) : (
            <div className="text-slate-600">كل العاملين في هذا الشهر لهم صفوف بالفعل.</div>
          )}
        </div>
      )}

      <div className="print-full max-h-[calc(100vh-230px)] overflow-auto rounded-lg border border-line bg-white" onScroll={() => setMenu(null)}>
        <table className="tbl" data-testid="attendance-grid">
          <thead>
            <tr>
              <th className="hidden sm:table-cell">الشهر</th>
              <th className="sticky right-0 z-[3] hidden min-w-[70px] sm:table-cell">الرقم</th>
              <th className="sticky right-0 z-[3] min-w-[120px] sm:right-[70px] sm:min-w-[170px]">الاسم</th>
              {Array.from({ length: 31 }, (_, i) => (
                <th key={i} className={cn("w-8 min-w-8 !px-0 text-center", focus.c === i && "!bg-navy-2")}>{i + 1}</th>
              ))}
              <th className="th-total">حضور</th>
              <th className="th-total">غياب</th>
              <th className="th-total">نصف يوم</th>
              <th className="th-total">إجازة</th>
              <th className="th-total">مرضي</th>
              <th className="min-w-[160px]">ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={42} className="p-6 text-center text-slate-500">لا توجد صفوف — استخدم «إضافة شهر جديد».</td></tr>
            )}
            {rows.map((row, r) => {
              const cnt = countCodes(row.days);
              const newMonth = r > 0 && rows[r - 1].month !== row.month;
              const dupCls = row.duplicate ? "[&>td]:!bg-[#FCA5A5]" : "";
              return (
                <Fragment key={row.id}>
                  {newMonth && (
                    <tr aria-hidden><td colSpan={42} className="!bg-gold !p-0" style={{ height: 3 }} /></tr>
                  )}
                  <tr className={dupCls} data-testid={`grid-row-${row.code}`}>
                    <td className="calc hidden sm:table-cell">{formatMonth(row.month)}</td>
                    <td className="sticky right-0 z-[1] calc hidden sm:table-cell">{row.code}</td>
                    <td className="sticky right-0 z-[1] calc font-medium sm:right-[70px]" title={row.duplicate ? "سطر مكرر لنفس الموظف في نفس الشهر" : undefined}>{row.name}</td>
                    {row.days.map((code, c) => {
                      const locked = isLocked(row, c);
                      const fri = !locked && weekdayOf(`${row.month}-${pad2(c + 1)}`) === weeklyOffDay;
                      return (
                        <td key={c} className={cn("!p-0 text-center", locked ? "c-out" : code ? `c-${code}` : fri ? "c-fri" : "")}>
                          {!locked && (
                            <button
                              ref={(el) => { if (el) cellRefs.current.set(`${r}-${c}`, el); else cellRefs.current.delete(`${r}-${c}`); }}
                              type="button"
                              aria-label={`${row.name} يوم ${c + 1}`}
                              data-day={c + 1}
                              className={cn("h-7 w-8 text-[15px] font-bold outline-none focus:ring-2 focus:ring-inset focus:ring-gold", (!canEdit || rowClosed(row)) && "cursor-default")}
                              onFocus={() => setFocus({ r, c })}
                              onClick={(e) => openMenu(e.currentTarget, r, c)}
                              onKeyDown={(e) => onKey(e, r, c)}
                            >
                              {code ?? ""}
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td className="calc num" data-testid="cnt-present">{format1(cnt.present)}</td>
                    <td className="calc num">{cnt.absent}</td>
                    <td className="calc num">{cnt.half}</td>
                    <td className="calc num">{cnt.leave}</td>
                    <td className="calc num">{cnt.sick}</td>
                    <td className="!py-0">
                      <input
                        aria-label={`ملاحظات ${row.name}`}
                        className="inp py-1"
                        defaultValue={row.notes}
                        readOnly={!canEdit || rowClosed(row)}
                        onBlur={(e) => { if (canEdit && !rowClosed(row) && e.target.value !== row.notes) run(setMonthNotes(row.id, e.target.value)); }}
                      />
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
          <div
            role="menu"
            className="fixed z-50 flex -translate-x-1/2 gap-1 rounded-md border border-gold bg-white p-1 shadow-lg"
            style={{ left: menu.x, top: menu.y }}
          >
            {CODES.map((c) => (
              <button key={c} role="menuitem" className={cn("h-8 w-8 rounded font-bold", `c-${c}`)} onClick={() => { setCell(menu.r, menu.c, c); setMenu(null); cellRefs.current.get(`${menu.r}-${menu.c}`)?.focus(); }}>
                {c}
              </button>
            ))}
            <button role="menuitem" className="h-8 rounded bg-page px-2 text-sm" onClick={() => { setCell(menu.r, menu.c, null); setMenu(null); }}>
              مسح
            </button>
          </div>
        </>
      )}
    </div>
  );
}
