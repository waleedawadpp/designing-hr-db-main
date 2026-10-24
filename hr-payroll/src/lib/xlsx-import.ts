/**
 * استيراد ملف الإكسل الحالي إلى قاعدة البيانات، ثم مقارنة الصافي مع الإكسل.
 * يستخدمه سكربت scripts/import-xlsx.ts وشاشة «استيراد من Excel».
 *
 * يقرأ الجداول بالاسم: tblEmp، tblGrid، tblOT، tblDed (ويتجاهل الأعمدة المحسوبة).
 * بعد الاستيراد يقارن صافي كل موظف مع القيم المحفوظة في الإكسل:
 *   - ورقة «الكشف الشهري» (للشهر المختار فيها)
 *   - جدول «لوحة_الموظفين» في «لوحة التحكم» (للشهر المختار فيها)
 * ويفشل (رمز خروج 1) إذا تجاوز أي فرق 0.001.
 * ملاحظة: الإكسل لا يحفظ قيمًا محسوبة إلا للشهر المختار في كل ورقة لحظة الحفظ.
 */
import path from "node:path";
import JSZip from "jszip";
import type { PrismaClient } from "@prisma/client";
import { CODES, DEDUCTION_ITEMS, daysInMonth, EXTRA_ITEMS, EMP_TYPES, MIN_DATE, isValidHM, pad2, toMonthKey } from "./payroll";
import { buildMonthlyReport } from "./report";

const TOLERANCE = 0.001;
const TOTAL_LABELS = new Set(["الإجمالي", "المجموع"]);
const SYSTEM_EMAIL = "import-xlsx@system";

// ───────────── قراءة مواقع الجداول من ملف xlsx ─────────────

interface TableLoc {
  sheet: string;
  ref: string;
  columns: string[];
}

function attr(xml: string, name: string): string | undefined {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(xml)?.[1];
}
function decodeXml(s: string) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

// ───────────── قارئ xlsx مباشر من XML ─────────────
// لا نعتمد على مكتبة لقراءة الخلايا: نقرأ القيم المحفوظة (<v>) كما هي، بما فيها نتيجة 0
// للمعادلات، ونعمل مع ملفات حفظتها برامج غير Excel.

type Raw = string | number | boolean | null;

interface XSheet {
  name: string;
  cells: Map<string, Raw>; // "B6" → القيمة
  maxRow: number;
}

interface XBook {
  sheets: Map<string, XSheet>;
  tables: Map<string, TableLoc>;
}

function colLetters(n: number): string {
  let s = "";
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

const get = (sh: XSheet, r: number, c: number): Raw => sh.cells.get(`${colLetters(c)}${r}`) ?? null;

async function loadBook(data: Uint8Array): Promise<XBook> {
  const zip = await JSZip.loadAsync(data);
  const read = async (p: string) => (await zip.file(p)?.async("string")) ?? "";
  const relTarget = (rels: string, id: string) => {
    const m = new RegExp(`<Relationship[^>]*Id="${id}"[^>]*>`).exec(rels)?.[0] ?? "";
    return attr(m, "Target") ?? "";
  };
  const resolve = (base: string, t: string) =>
    t.startsWith("/") ? t.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(base), t));

  const shared = ((await read("xl/sharedStrings.xml")).match(/<si>[\s\S]*?<\/si>/g) ?? []).map((si) =>
    decodeXml((si.match(/<t(?: [^>]*)?>([\s\S]*?)<\/t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, "")).join("")),
  );

  const wb = await read("xl/workbook.xml");
  const wbRels = await read("xl/_rels/workbook.xml.rels");
  const sheets = new Map<string, XSheet>();
  const tables = new Map<string, TableLoc>();
  for (const sm of wb.match(/<sheet [^>]*\/>/g) ?? []) {
    const name = decodeXml(attr(sm, "name") ?? "");
    const sheetPath = resolve("xl/workbook.xml", relTarget(wbRels, attr(sm, "r:id") ?? ""));
    const xml = await read(sheetPath);
    const cells = new Map<string, Raw>();
    let maxRow = 0;
    for (const m of xml.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const t = attr(m[3], "t");
      const body = m[4] ?? "";
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let val: Raw = null;
      if (t === "s") val = v != null ? shared[Number(v)] ?? null : null;
      else if (t === "inlineStr") val = decodeXml((/<t(?: [^>]*)?>([\s\S]*?)<\/t>/.exec(body)?.[1] ?? ""));
      else if (t === "str") val = v != null ? decodeXml(v) : null;
      else if (t === "b") val = v === "1";
      else if (t === "e") val = null;
      else if (v != null && v !== "") val = Number(v);
      if (val !== null && val !== "") {
        cells.set(`${m[1]}${m[2]}`, val);
        maxRow = Math.max(maxRow, Number(m[2]));
      }
    }
    sheets.set(name, { name, cells, maxRow });

    const relsPath = `${path.posix.dirname(sheetPath)}/_rels/${path.posix.basename(sheetPath)}.rels`;
    const sRels = await read(relsPath);
    for (const tp of xml.match(/<tablePart [^>]*\/>/g) ?? []) {
      const txml = await read(resolve(sheetPath, relTarget(sRels, attr(tp, "r:id") ?? "")));
      const head = /<table [^>]*>/.exec(txml)?.[0] ?? "";
      const tname = decodeXml(attr(head, "name") ?? attr(head, "displayName") ?? "");
      const columns = (txml.match(/<tableColumn [^>]*>/g) ?? []).map((c) => decodeXml(attr(c, "name") ?? ""));
      tables.set(tname, { sheet: name, ref: attr(head, "ref") ?? "", columns });
    }
  }
  return { sheets, tables };
}

function colNum(letters: string) {
  return letters.split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
}
function parseRef(ref: string) {
  const [a, b] = ref.split(":");
  const m1 = /([A-Z]+)(\d+)/.exec(a)!;
  const m2 = /([A-Z]+)(\d+)/.exec(b)!;
  return { c1: colNum(m1[1]), r1: +m1[2], c2: colNum(m2[1]), r2: +m2[2] };
}

function readTable(sh: XSheet, loc: TableLoc): Record<string, Raw>[] {
  const { c1, r1, r2 } = parseRef(loc.ref);
  const rows: Record<string, Raw>[] = [];
  for (let r = r1 + 1; r <= r2; r++) {
    const row: Record<string, Raw> = {};
    loc.columns.forEach((name, i) => (row[name] = get(sh, r, c1 + i)));
    rows.push(row);
  }
  return rows;
}

const str = (v: Raw) => (v == null ? "" : String(v).trim());
const num = (v: Raw): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};
function isoDate(v: Raw): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(v).trim());
  if (m) return `${m[3]}-${pad2(+m[2])}-${pad2(+m[1])}`;
  return null;
}

// ───────────── التنفيذ ─────────────

export interface ImportOptions {
  /** اسم الملف (للسجل فقط) */
  fileName: string;
  reset?: boolean;
  dryRun?: boolean;
  /** يرفض الاستيراد إن كانت القاعدة غير فارغة حتى مع reset (للاستيراد من الشاشة) */
  requireEmpty?: boolean;
  /** البريد المسجَّل في سجل التدقيق */
  userEmail?: string;
}

export interface ImportResult {
  ok: boolean;
  lines: string[];
}

/** يستورد الملف ويقارن الصافي مع الإكسل. ok = false إذا تجاوز أي فرق 0.001. */
export async function importWorkbook(db: PrismaClient, data: Uint8Array, opts: ImportOptions): Promise<ImportResult> {
  const lines: string[] = [];
  const out = (s: string) => lines.push(s);
  const { reset = false, dryRun = false, fileName } = opts;
  const book = await loadBook(data);
  const tables = book.tables;
  for (const t of ["tblEmp", "tblGrid", "tblOT", "tblDed"]) {
    if (!tables.has(t)) throw new Error(`الجدول ${t} غير موجود في الملف`);
    out(`• ${t}: ورقة «${tables.get(t)!.sheet}» النطاق ${tables.get(t)!.ref}`);
  }

  const sheet = (name: string) => {
    const sh = book.sheets.get(name);
    if (!sh) throw new Error(`الورقة ${name} غير موجودة`);
    return sh;
  };
  const tbl = (name: string) => readTable(sheet(tables.get(name)!.sheet), tables.get(name)!);

  const warnings: string[] = [];

  const existing = await db.employee.count();
  if (existing && opts.requireEmpty) {
    throw new Error(`قاعدة البيانات فيها ${existing} موظفًا — الاستيراد من الشاشة متاح لقاعدة فارغة فقط.`);
  }
  if (existing && !reset && !dryRun) {
    throw new Error(`قاعدة البيانات فيها ${existing} موظفًا. استخدم --reset لمسحها قبل الاستيراد (أو --dry-run).`);
  }

  if (!dryRun && reset) {
    await db.attendanceDay.deleteMany();
    await db.attendanceMonth.deleteMany();
    await db.extraEntry.deleteMany();
    await db.deductionEntry.deleteMany();
    await db.employee.deleteMany();
  }
  await db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  // 1) الموظفون
  const empRows = tbl("tblEmp").filter((r) => str(r["الاسم"]));
  const byName = new Map<string, string>();
  let order = 0;
  for (const r of empRows) {
    const name = str(r["الاسم"]).replace(/\s+/g, " ");
    const code = str(r["الرقم"]);
    const type = str(r["النوع"]);
    if (!(EMP_TYPES as readonly string[]).includes(type)) warnings.push(`نوع غير معروف «${type}» للموظف ${name}`);
    if (byName.has(name)) {
      warnings.push(`اسم مكرر في tblEmp: ${name} — تم تجاهل التكرار`);
      continue;
    }
    const data = {
      code,
      name,
      type,
      monthlySalary: num(r["الراتب الشهري"]),
      dailyWage: num(r["الأجرة اليومية"]),
      dailyHours: num(r["ساعات الدوام اليومي"]) ?? 9,
      hireDate: isoDate(r["تاريخ التعيين"]),
      endDate: isoDate(r["تاريخ انتهاء الخدمة"]),
      leavesBeforeSystem: num(r["إجازات مسحوبة قبل النظام"]),
      notes: str(r["ملاحظات"]) || null,
      sortOrder: ++order,
    };
    if (dryRun) byName.set(name, `dry-${order}`);
    else byName.set(name, (await db.employee.create({ data })).id);
  }
  out(`✔ الموظفون: ${byName.size}`);

  // 2) الحضور
  const seen = new Map<string, number>();
  let gridCount = 0;
  for (const r of tbl("tblGrid")) {
    const month = isoDate(r["الشهر"])?.slice(0, 7);
    const name = str(r["الاسم"]).replace(/\s+/g, " ");
    if (!month && !name) continue;
    const empId = byName.get(name);
    if (!month || !empId) {
      warnings.push(`سطر حضور متجاهَل: الشهر=${month ?? "?"} الاسم=${name || "?"}`);
      continue;
    }
    const key = `${empId}|${month}`;
    const dupSeq = seen.get(key) ?? 0;
    seen.set(key, dupSeq + 1);
    if (dupSeq) warnings.push(`تكرار: ${name} في ${month} (يُلوَّن بالأحمر في الشاشة)`);
    const days: { day: number; code: string }[] = [];
    for (let d = 1; d <= 31; d++) {
      const v = str(r[String(d)]);
      if (!v) continue;
      if (d > daysInMonth(+month.slice(0, 4), +month.slice(5, 7))) {
        warnings.push(`رمز «${v}» في يوم ${d} غير موجود في شهر ${month} — ${name} (تم تجاهله؛ الإكسل كان يحسبه)`);
        continue;
      }
      if (!(CODES as readonly string[]).includes(v)) {
        warnings.push(`رمز غير صحيح «${v}» — ${name} ${month} يوم ${d} (تم تجاهله)`);
        continue;
      }
      days.push({ day: d, code: v });
    }
    if (!dryRun) {
      const m = await db.attendanceMonth.create({ data: { employeeId: empId, month, dupSeq, notes: str(r["ملاحظات"]) || null } });
      if (days.length) await db.attendanceDay.createMany({ data: days.map((x) => ({ ...x, monthId: m.id })) });
    }
    gridCount++;
  }
  out(`✔ أسطر الحضور: ${gridCount}`);

  // 3) الإضافي والمكافآت
  let otCount = 0;
  for (const r of tbl("tblOT")) {
    const date = isoDate(r["التاريخ"]);
    const name = str(r["الاسم"]).replace(/\s+/g, " ");
    const item = str(r["البند"]) || null;
    const actualTime = num(r["الوقت الفعلي (س.د)"]);
    const bonusAmount = num(r["مبلغ المكافأة"]);
    if (!date && !name && !item && !actualTime && !bonusAmount) continue;
    if (item && !(EXTRA_ITEMS as readonly string[]).includes(item)) warnings.push(`بند إضافي غير معروف «${item}»`);
    if (actualTime != null && !isValidHM(actualTime)) warnings.push(`وقت إضافي غير صالح ${actualTime} — ${name}`);
    if (date && date < MIN_DATE) warnings.push(`تاريخ قبل 2020 في سجل الإضافي: ${date}`);
    const employeeId = byName.get(name) ?? null;
    if (!dryRun)
      await db.extraEntry.create({
        data: { date, employeeId, rawName: employeeId ? null : name || null, item, actualTime, bonusAmount, notes: str(r["ملاحظات"]) || null },
      });
    otCount++;
  }
  out(`✔ سجل الإضافي: ${otCount}`);

  // 4) الخصومات
  let dedCount = 0;
  for (const r of tbl("tblDed")) {
    const date = isoDate(r["التاريخ"]);
    const name = str(r["الاسم"]).replace(/\s+/g, " ");
    const item = str(r["البند"]) || null;
    const lateMinutes = num(r["دقائق التأخير"]);
    const amount = num(r["مبلغ الغرامة / الخصم"]);
    if (!date && !name && !item && !lateMinutes && !amount) continue;
    if (item && !(DEDUCTION_ITEMS as readonly string[]).includes(item)) warnings.push(`بند خصم غير معروف «${item}»`);
    const employeeId = byName.get(name) ?? null;
    if (!dryRun)
      await db.deductionEntry.create({
        data: { date, employeeId, rawName: employeeId ? null : name || null, item, lateMinutes, amount, notes: str(r["ملاحظات"]) || null },
      });
    dedCount++;
  }
  out(`✔ سجل الخصم: ${dedCount}`);

  if (!dryRun) {
    await db.auditLog.create({
      data: { userEmail: opts.userEmail ?? SYSTEM_EMAIL, action: "create", entity: "Import", entityId: path.basename(fileName), summary: `استيراد ${path.basename(fileName)}: ${byName.size} موظف، ${gridCount} سطر حضور، ${otCount} إضافي، ${dedCount} خصم` },
    });
  }

  if (warnings.length) {
    out(`\n⚠ ملاحظات الاستيراد (${warnings.length}):`);
    for (const w of warnings) out("  - " + w);
  }
  if (dryRun) {
    out("\n(تجربة فقط) لم يُكتب شيء ولم تُجرَ المقارنة.");
    return { ok: true, lines };
  }

  // 5) المقارنة مع القيم المحفوظة في الإكسل
  const expected: { source: string; ym: string; name: string; net: number }[] = [];

  const ms = book.sheets.get("الكشف الشهري");
  if (ms) {
    const y = num(ms.cells.get("B2") ?? null);
    const m = num(ms.cells.get("G2") ?? null);
    // عمود الصافي: نبحث عن عنوان «الصافي» في الصف 5
    let netCol = 0;
    for (let c = 1; c <= 80; c++) if (str(get(ms, 5, c)) === "الصافي") netCol = c;
    if (y && m && netCol) {
      for (let r = 6; r <= ms.maxRow; r++) {
        const name = str(get(ms, r, 2));
        const net = num(get(ms, r, netCol));
        if (!name || net == null || TOTAL_LABELS.has(name)) continue;
        expected.push({ source: "الكشف الشهري", ym: toMonthKey(y, m), name: name.replace(/\s+/g, " "), net });
      }
    }
  }
  const ds = book.sheets.get("لوحة التحكم");
  const dashLoc = tables.get("لوحة_الموظفين");
  if (ds && dashLoc) {
    const y = num(ds.cells.get("D4") ?? null);
    const m = num(ds.cells.get("G4") ?? null);
    if (y && m) {
      for (const r of readTable(ds, dashLoc)) {
        const name = str(r["الاسم"]);
        const net = num(r["الصافي"]);
        if (!name || net == null || TOTAL_LABELS.has(name)) continue;
        expected.push({ source: "لوحة التحكم", ym: toMonthKey(y, m), name: name.replace(/\s+/g, " "), net });
      }
    }
  }

  if (!expected.length) {
    out("\n⚠ لا توجد قيم صافي محفوظة في الإكسل للمقارنة.");
    return { ok: false, lines };
  }

  const reports = new Map<string, Awaited<ReturnType<typeof buildMonthlyReport>>>();
  for (const ym of new Set(expected.map((e) => e.ym))) reports.set(ym, await buildMonthlyReport(db, ym));

  let failures = 0;
  let maxDiff = 0;
  out("\nالمقارنة (الصافي: الإكسل ↔ التطبيق):");
  out("المصدر | الشهر | الاسم | الإكسل | التطبيق | الفرق");
  for (const e of expected) {
    const row = reports.get(e.ym)!.rows.find((r) => r.employee.name === e.name);
    if (!row) {
      failures++;
      out(`✖ ${e.source} | ${e.ym} | ${e.name} | ${e.net.toFixed(3)} | — | غير موجود في التطبيق`);
      continue;
    }
    const diff = Math.abs(row.net - e.net);
    maxDiff = Math.max(maxDiff, diff);
    const bad = diff > TOLERANCE;
    if (bad) failures++;
    out(`${bad ? "✖" : "✔"} ${e.source} | ${e.ym} | ${e.name} | ${e.net.toFixed(3)} | ${row.net.toFixed(3)} | ${diff.toExponential(2)}`);
  }
  // موظفون يعرضهم التطبيق ولا يعرضهم الإكسل
  for (const ym of reports.keys()) {
    const names = new Set(expected.filter((e) => e.ym === ym).map((e) => e.name));
    for (const r of reports.get(ym)!.rows)
      if (!names.has(r.employee.name)) {
        failures++;
        out(`✖ ${ym} | ${r.employee.name} | يظهر في التطبيق ولا يظهر في الإكسل`);
      }
  }

  out(`\nعدد المقارنات: ${expected.length} • أكبر فرق: ${maxDiff.toExponential(2)} • الإخفاقات: ${failures}`);
  if (failures) {
    out(`✖ فشل: ${failures} فرق يتجاوز ${TOLERANCE}`);
    return { ok: false, lines };
  }
  out(`✔ نجح: كل الفروق ≤ ${TOLERANCE}`);
  return { ok: true, lines };
}
