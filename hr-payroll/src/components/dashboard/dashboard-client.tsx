"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Combobox } from "@/components/combobox";
import { format1, formatInt, formatOMR, formatPct, fmtNumber3 } from "@/lib/payroll";
import { MONTHS, YEARS, cn } from "@/lib/utils";

export interface DashRow {
  id: string;
  code: string;
  name: string;
  type: string;
  present: number;
  workingDays: number;
  rate: number;
  salary: number;
  due: number;
  extras: number;
  deductions: number;
  net: number;
  codes: (string | null)[];
}

const NAVY = "#13294B";
const GOLD = "#C9A227";

function rateColor(r: number) {
  // تدرّج: أحمر ← أصفر ← أخضر
  const v = Math.max(0, Math.min(1, r));
  const hue = v * 120;
  return `hsl(${hue} 70% 88%)`;
}

export function DashboardClient({
  ym,
  rows,
  presentPerDay,
  extrasCount,
  closed,
}: {
  ym: string;
  rows: DashRow[];
  presentPerDay: { all: number; employees: number; drivers: number }[];
  extrasCount: number;
  closed?: boolean;
}) {
  const router = useRouter();
  const path = usePathname();
  const [y, m] = ym.split("-").map(Number);
  const [selId, setSelId] = useState<string | undefined>(rows[0]?.id);
  const [typeFilter, setTypeFilter] = useState<string>("الكل");
  const sel = rows.find((r) => r.id === selId) ?? rows[0];

  const k = useMemo(() => {
    const sum = (f: (r: DashRow) => number) => rows.reduce((a, r) => a + f(r), 0);
    const n = rows.length;
    return {
      count: n,
      emps: rows.filter((r) => r.type === "موظف").length,
      drivers: rows.filter((r) => r.type === "سائق يومي").length,
      salary: sum((r) => r.salary),
      due: sum((r) => r.due),
      rate: n ? sum((r) => r.rate) / n : 0,
      presentCount: rows.filter((r) => r.present > 0).length,
      extras: sum((r) => r.extras),
      net: sum((r) => r.net),
      deductions: sum((r) => r.deductions),
      negatives: rows.filter((r) => r.net < 0),
    };
  }, [rows]);

  const filtered = typeFilter === "الكل" ? rows : rows.filter((r) => r.type === typeFilter);
  const maxSalary = Math.max(1, ...filtered.map((r) => r.salary));
  const tot = filtered.reduce(
    (a, r) => ({ present: a.present + r.present, rate: a.rate + r.rate, salary: a.salary + r.salary, due: a.due + r.due, extras: a.extras + r.extras, deductions: a.deductions + r.deductions, net: a.net + r.net }),
    { present: 0, rate: 0, salary: 0, due: 0, extras: 0, deductions: 0, net: 0 },
  );

  const empChart = (sel?.codes ?? []).map((c, i) => ({ day: i + 1, v: c === "ح" ? 1 : c === "ن" ? 0.5 : 0 }));
  const dayChart = presentPerDay.map((p, i) => ({ day: i + 1, employees: p.employees, drivers: p.drivers }));
  const top = [...rows].sort((a, b) => b.present - a.present).slice(0, 15).map((r) => ({ name: r.name, v: r.present }));

  function go(ny: number, nm: number) {
    router.push(`${path}?y=${ny}&m=${nm}`);
  }

  const cards = [
    { t: "عدد العاملين", v: String(k.count), s: `${k.emps} موظف • ${k.drivers} سائق` },
    { t: "إجمالي الرواتب الشهرية", v: formatOMR(k.salary), s: `متوسط ${formatInt(k.count ? k.salary / k.count : 0)} ر.ع.` },
    { t: "الأجور المستحقة", v: formatOMR(k.due), s: "بعد خصم الغياب" },
    { t: "متوسط نسبة الحضور", v: formatPct(k.rate), s: `${k.presentCount} حاضر من ${k.count}` },
    { t: "الإضافي والمكافآت", v: formatOMR(k.extras), s: `${extrasCount} تسجيل هذا الشهر` },
    { t: "صافي المستحق", v: formatOMR(k.net), s: `بعد خصم ${fmtNumber3(k.deductions)} ر.ع.` },
  ];

  return (
    <div className="space-y-3">
      <div className="no-print flex flex-wrap items-center gap-3 rounded-lg bg-navy px-4 py-2 text-white">
        <label className="text-sm">السنة</label>
        <select aria-label="السنة" className="select-cream" value={y} onChange={(e) => go(Number(e.target.value), m)}>
          {YEARS.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <label className="text-sm">الشهر</label>
        <select aria-label="الشهر" className="select-cream" value={m} onChange={(e) => go(y, Number(e.target.value))}>
          {MONTHS.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <span className="text-sm text-gold">◄ اختر السنة والشهر لعرض أي فترة — البيانات من السجلات</span>
      </div>

      {k.negatives.length > 0 && (
        <div role="alert" className="rounded border border-[#B91C1C] bg-[#FEE2E2] px-3 py-2 text-sm font-semibold text-[#B91C1C]">
          ⚠ صافي بالسالب هذا الشهر: {k.negatives.map((r) => r.name).join("، ")} — الخصومات أكبر من المستحق.
        </div>
      )}
      {!closed && rows.length > 0 && (
        <div className="no-print rounded border border-gold/60 bg-cream px-3 py-2 text-sm text-[#B45309]">
          الشهر غير معتمد بعد — الأرقام تتغير مع أي تعديل. بعد مراجعة الرواتب اعتمده من «الكشف الشهري».
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <div key={c.t} className="rounded-lg border border-line border-t-4 border-t-gold bg-white p-3 shadow-sm" data-testid={`kpi-${c.t}`}>
            <div className="text-xs font-semibold text-slate-500">{c.t}</div>
            <div className="money mt-1 text-xl font-bold text-navy">{c.v}</div>
            <div className="mt-1 text-xs text-slate-500">{c.s}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-lg border border-line bg-white shadow-sm">
          <div className="rounded-t-lg border-b-2 border-gold bg-navy px-3 py-2 text-sm font-bold text-white">بطاقة الموظف</div>
          <div className="p-3">
            <div className="mb-3 rounded border-2 border-gold bg-cream px-2 py-1">
              <Combobox
                ariaLabel="اختر الموظف"
                options={rows.map((r) => ({ value: r.id, label: r.name }))}
                value={sel?.id}
                onChange={setSelId}
                placeholder="▼ اختر الموظف"
              />
            </div>
            {sel && (
              <dl className="grid grid-cols-2 gap-y-1.5 text-sm" data-testid="employee-card">
                {[
                  ["الرقم الوظيفي", sel.code],
                  ["النوع", sel.type],
                  ["أيام الحضور", `${format1(sel.present)} يوم`],
                  ["نسبة الحضور", formatPct(sel.rate)],
                  ["الراتب الشهري", formatOMR(sel.salary)],
                  ["الأجرة المستحقة", formatOMR(sel.due)],
                  ["الإضافي والمكافآت", formatOMR(sel.extras)],
                  ["الخصومات والغرامات", formatOMR(sel.deductions)],
                  ["الصافي المستحق", formatOMR(sel.net)],
                ].map(([a, b]) => (
                  <div key={a} className="contents">
                    <dt className="text-slate-500">{a}</dt>
                    <dd className={cn("money font-semibold text-navy", a === "الصافي المستحق" && "text-base", a === "الصافي المستحق" && sel.net < 0 && "text-[#B91C1C]")} data-testid={`card-${a}`}>{b}</dd>
                  </div>
                ))}
              </dl>
            )}
            {sel && (
              <Link
                href={`/payslip?y=${y}&m=${m}&emp=${sel.id}`}
                className="no-print mt-3 inline-block rounded border border-gold bg-cream px-3 py-1 text-sm text-navy hover:bg-gold/20"
              >
                قسيمة الراتب ←
              </Link>
            )}
          </div>
        </div>
        <ChartBox title={`الحضور اليومي: ${sel?.name ?? ""}`}>
          <BarChart data={empChart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#D5DCE6" />
            <XAxis dataKey="day" reversed tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 1]} ticks={[0, 0.5, 1]} orientation="right" tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => [String(v), "الحضور"]} labelFormatter={(l) => `يوم ${l}`} />
            <Bar dataKey="v" fill={NAVY} />
          </BarChart>
        </ChartBox>
        <ChartBox title="الحضور اليومي للشهر">
          <LineChart data={dayChart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#D5DCE6" />
            <XAxis dataKey="day" reversed tick={{ fontSize: 10 }} />
            <YAxis allowDecimals={false} orientation="right" tick={{ fontSize: 10 }} />
            <Tooltip labelFormatter={(l) => `يوم ${l}`} />
            <Legend />
            <Line type="monotone" dataKey="employees" name="الموظفون الحاضرون" stroke={NAVY} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="drivers" name="السواق الحاضرون" stroke={GOLD} strokeWidth={2} dot={false} />
          </LineChart>
        </ChartBox>
      </div>

      <ChartBox title="أعلى 15 عاملًا في أيام الحضور" height={380}>
        <BarChart data={top} layout="vertical" margin={{ left: 10, right: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#D5DCE6" />
          <XAxis type="number" reversed tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="name" orientation="right" width={170} tick={{ fontSize: 11 }} interval={0} />
          <Tooltip formatter={(v) => [String(v), "أيام الحضور"]} />
          <Bar dataKey="v" fill={GOLD} />
        </BarChart>
      </ChartBox>

      <div className="overflow-hidden rounded-lg border border-line bg-white shadow-sm">
        <div className="flex items-center justify-between border-b-2 border-gold bg-navy px-3 py-2 text-sm font-bold text-white">
          <span>كشف الموظفين</span>
          <span className="no-print flex items-center gap-1 font-normal">
            النوع:
            {["الكل", "موظف", "سائق يومي"].map((t) => (
              <button key={t} onClick={() => setTypeFilter(t)} className={cn("rounded px-2 py-0.5 ring-1 ring-gold", typeFilter === t ? "bg-gold text-navy" : "text-white")}>
                {t}
              </button>
            ))}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="tbl w-full" data-testid="dashboard-table">
            <thead>
              <tr>
                <th>#</th><th>الرقم الوظيفي</th><th>الاسم</th><th>النوع</th><th>أيام الحضور</th><th>أيام العمل</th>
                <th>نسبة الحضور</th><th>الراتب الشهري</th><th>الأجرة المستحقة</th><th>الإضافي والمكافآت</th><th>الخصومات والغرامات</th><th className="th-total">الصافي</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} onClick={() => setSelId(r.id)} className={cn("cursor-pointer", r.id === sel?.id && "[&>td]:!bg-cream")} data-testid={`dash-row-${r.code}`}>
                  <td>{i + 1}</td>
                  <td>{r.code}</td>
                  <td className="font-medium">{r.name}</td>
                  <td>{r.type}</td>
                  <td className="num">{format1(r.present)}</td>
                  <td className="num">{r.workingDays}</td>
                  <td className="num" style={{ background: rateColor(r.rate) }}>{formatPct(r.rate)}</td>
                  <td className="num relative">
                    <span className="absolute inset-y-1 right-0 bg-[#1F4E79]/15" style={{ width: `${(r.salary / maxSalary) * 100}%` }} />
                    <span className="relative">{formatOMR(r.salary)}</span>
                  </td>
                  <td className="num">{formatOMR(r.due)}</td>
                  <td className="num">{formatOMR(r.extras)}</td>
                  <td className={cn("num", r.deductions > 0 && "font-semibold text-[#B91C1C]")}>{formatOMR(r.deductions)}</td>
                  <td className={cn("num font-bold", r.net < 0 && "!bg-[#FEE2E2] text-[#B91C1C]")} data-testid="dash-net">{formatOMR(r.net)}</td>
                </tr>
              ))}
              <tr className="font-bold [&>td]:!bg-[#E8F5EC]">
                <td colSpan={4}>المجموع</td>
                <td className="num">{format1(tot.present)}</td>
                <td />
                <td className="num">{formatPct(filtered.length ? tot.rate / filtered.length : 0)}</td>
                <td className="num">{formatOMR(tot.salary)}</td>
                <td className="num">{formatOMR(tot.due)}</td>
                <td className="num">{formatOMR(tot.extras)}</td>
                <td className="num">{formatOMR(tot.deductions)}</td>
                <td className="num">{formatOMR(tot.net)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ChartBox({ title, children, height = 260 }: { title: string; children: React.ReactElement; height?: number }) {
  return (
    <div className="rounded-lg border border-line bg-white shadow-sm">
      <div className="rounded-t-lg border-b-2 border-gold bg-navy px-3 py-2 text-sm font-bold text-white">{title}</div>
      <div className="p-2" style={{ height }} dir="ltr">
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </div>
  );
}
