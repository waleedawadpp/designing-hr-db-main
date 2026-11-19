/**
 * biometric.ts — تحويل «سجل الحركات» من جهاز البصمة إلى رموز حضور (دوال نقية، تعمل في الخادم والمتصفح).
 *
 * الملف المتوقع (تصدير ZKTeco وما يشبهه): صف عناوين فيه رقم الموظف والاسم ووقت البصمة، مثل
 *   Emp ID | Name | Time | Work Code | Attendance State | Device Name
 *   01     | faez | 11/01/2026 08:08:06 | 0 | 0 | …
 *
 * القواعد:
 *  - أي بصمة في اليوم = «ح» (كثير من الأيام فيها بصمة دخول فقط).
 *  - يوم عمل بلا بصمة = «غ».
 *  - يوم العطلة الأسبوعية: لا يُقترح شيء، إلا «ح» إن وُجدت بصمة والخانة فارغة.
 *  - لا تُستبدل «إ» (إجازة) ولا «م»، ولا «ن» إن وُجدت بصمة.
 *  - الخانة الفارغة تُعبّأ تلقائيًا؛ الخانة التي فيها رمز مختلف تُعرض «استبدالًا» غير محدد افتراضيًا.
 *  - الأيام خارج مدة خدمة الموظف أو خارج فترة التقرير لا تُمس.
 */
import { pad2, weekdayOf } from "./payroll";

export interface DevicePunches {
  deviceId: string;
  deviceName: string;
  /** التاريخ YYYY-MM-DD ← أوقات البصمات HH:MM مرتبة */
  days: Record<string, string[]>;
}

export interface PunchLog {
  employees: DevicePunches[];
  /** أول وآخر تاريخ في الملف (YYYY-MM-DD) */
  start: string;
  end: string;
  punches: number;
}

export class BiometricFormatError extends Error {}

const ID_HEADERS = ["emp id", "ac-no", "ac-no.", "no.", "user id", "employee id", "id", "enroll id", "رقم الموظف", "الرقم"];
const NAME_HEADERS = ["name", "employee name", "الاسم", "اسم الموظف"];
const TIME_HEADERS = ["time", "date/time", "datetime", "date time", "check time", "checktime", "punch time", "الوقت", "التاريخ والوقت"];
const SUMMARY_HEADERS = ["actual work", "required work", "timetable"];

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

function findCol(header: string[], names: string[]) {
  return header.findIndex((h) => names.includes(norm(h)));
}

const DT = /^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})[ T]+(\d{1,2}):(\d{2})/;

/** يقرأ صفوف الورقة (كل خلية نص أو تاريخ) ويعيد البصمات مجمعة لكل موظف ويوم. */
export function parsePunchLog(rows: unknown[][]): PunchLog {
  const headerIdx = rows.findIndex((r) => r.some((c) => TIME_HEADERS.includes(norm(c))) && r.some((c) => ID_HEADERS.includes(norm(c))));
  if (headerIdx < 0) {
    if (rows.some((r) => r.filter((c) => SUMMARY_HEADERS.includes(norm(c))).length >= 2)) {
      throw new BiometricFormatError(
        "هذا تقرير ملخص يومي وليس سجل الحركات — صدّر من برنامج البصمة تقرير «سجل الحركات / Attendance Log» الذي يُظهر وقت كل بصمة",
      );
    }
    throw new BiometricFormatError("لم أجد صف العناوين (رقم الموظف ووقت البصمة) — تأكد أن الملف «سجل الحركات» من جهاز البصمة");
  }
  const header = rows[headerIdx].map((c) => String(c ?? ""));
  const cId = findCol(header, ID_HEADERS);
  const cName = findCol(header, NAME_HEADERS);
  const cTime = findCol(header, TIME_HEADERS);

  // نقرأ الأجزاء أولًا ثم نحدد ترتيب اليوم والشهر من الملف كله (11/16 = شهر/يوم)
  type Raw = { id: string; name: string; a: number; b: number; y: number; hm: string };
  const raws: Raw[] = [];
  for (const r of rows.slice(headerIdx + 1)) {
    const id = String(r[cId] ?? "").trim();
    const t = r[cTime];
    if (!id || t == null || t === "") continue;
    const name = cName >= 0 ? String(r[cName] ?? "").trim() : "";
    if (t instanceof Date) {
      raws.push({ id, name, a: t.getUTCMonth() + 1, b: t.getUTCDate(), y: t.getUTCFullYear(), hm: `${pad2(t.getUTCHours())}:${pad2(t.getUTCMinutes())}` });
      continue;
    }
    const m = DT.exec(String(t).trim());
    if (!m) throw new BiometricFormatError(`وقت بصمة غير مفهوم: «${String(t)}»`);
    const hm = `${pad2(Number(m[4]))}:${m[5]}`;
    if (m[1].length === 4) raws.push({ id, name, y: Number(m[1]), a: Number(m[2]), b: Number(m[3]), hm }); // YYYY-MM-DD
    else raws.push({ id, name, a: Number(m[1]), b: Number(m[2]), y: Number(m[3].length === 2 ? "20" + m[3] : m[3]), hm });
  }
  if (!raws.length) throw new BiometricFormatError("الملف لا يحتوي على أي بصمة");
  // a/b: إن ظهر في الجزء الأول رقم > 12 فهو يوم/شهر، وإلا فشهر/يوم (تصدير ZKTeco الافتراضي)
  const dayFirst = raws.some((r) => r.a > 12);

  const map = new Map<string, DevicePunches>();
  let start = "9999-12-31";
  let end = "0000-01-01";
  for (const r of raws) {
    const month = dayFirst ? r.b : r.a;
    const day = dayFirst ? r.a : r.b;
    if (month < 1 || month > 12 || day < 1 || day > 31) throw new BiometricFormatError(`تاريخ غير صحيح في الملف: ${r.a}/${r.b}/${r.y}`);
    const date = `${r.y}-${pad2(month)}-${pad2(day)}`;
    if (date < start) start = date;
    if (date > end) end = date;
    const e = map.get(r.id) ?? { deviceId: r.id, deviceName: r.name, days: {} };
    if (!e.deviceName && r.name) e.deviceName = r.name;
    (e.days[date] ??= []).push(r.hm);
    map.set(r.id, e);
  }
  for (const e of map.values()) for (const d of Object.values(e.days)) d.sort();
  const employees = [...map.values()].sort((x, y) => x.deviceId.localeCompare(y.deviceId, "en", { numeric: true }));
  return { employees, start, end, punches: raws.length };
}

/** كل التواريخ من start إلى end (شاملة). */
export function datesBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (d <= last) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export interface PlanEmployee {
  id: string;
  hireDate: string | null;
  endDate: string | null;
}

export type CellKind =
  | "fill" //      خانة فارغة ستُعبأ
  | "overwrite" // خانة فيها رمز مختلف (غير محددة افتراضيًا)
  | "same" //      الرمز الحالي يطابق المقترح
  | "kept" //      إجازة/م/ن تبقى كما هي
  | "off" //       عطلة أسبوعية بلا بصمة
  | "inactive"; // خارج مدة الخدمة

export interface PlanCell {
  date: string;
  current: string | null;
  proposed: string | null;
  kind: CellKind;
  /** أوقات البصمات في هذا اليوم */
  times: string[];
}

const KEEP_ALWAYS = new Set(["إ", "م"]);

/** يقترح رمز كل يوم في فترة التقرير لموظف واحد. current: التاريخ ← الرمز الحالي. */
export function planEmployee(
  emp: PlanEmployee,
  punches: Record<string, string[]>,
  current: Record<string, string | null | undefined>,
  start: string,
  end: string,
  weeklyOffDay: number,
  holidays: ReadonlySet<string> = new Set(),
): PlanCell[] {
  return datesBetween(start, end).map((date) => {
    const times = punches[date] ?? [];
    const cur = current[date] ?? null;
    const base = { date, current: cur, times };
    if ((emp.hireDate && date < emp.hireDate) || (emp.endDate && date > emp.endDate)) return { ...base, proposed: null, kind: "inactive" };
    const isOff = weekdayOf(date) === weeklyOffDay || holidays.has(date);
    if (isOff && !times.length) return { ...base, proposed: null, kind: "off" };
    if (cur && (KEEP_ALWAYS.has(cur) || (cur === "ن" && times.length))) return { ...base, proposed: cur, kind: "kept" };
    if (isOff && cur) return { ...base, proposed: cur, kind: "kept" };
    const proposed = times.length ? "ح" : "غ";
    if (cur === proposed) return { ...base, proposed, kind: "same" };
    return { ...base, proposed, kind: cur ? "overwrite" : "fill" };
  });
}

/** هل تُحفظ هذه الخانة افتراضيًا؟ */
export function selectedByDefault(cell: PlanCell) {
  return cell.kind === "fill";
}
