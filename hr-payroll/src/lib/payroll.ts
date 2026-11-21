/**
 * payroll.ts — كل قواعد حساب الحضور والرواتب (دوال نقية بلا قاعدة بيانات).
 * تطابق معادلات ملف الإكسل حرفيًا. الحساب بالدقة الكاملة، والتقريب عند العرض فقط.
 *
 * الاصطلاحات:
 *  - التاريخ نص "YYYY-MM-DD"، والشهر نص "YYYY-MM".
 *  - weeklyOffDay: رقم يوم الأسبوع (0 = الأحد … 5 = الجمعة).
 */

export const EMP_TYPES = ["موظف", "سائق يومي"] as const;
export type EmpType = (typeof EMP_TYPES)[number];

export const CODES = ["ح", "غ", "ن", "إ", "م"] as const;
export type AttendanceCode = (typeof CODES)[number];

export const EXTRA_ITEMS = ["ساعات إضافية", "مكافأة"] as const;
export type ExtraItem = (typeof EXTRA_ITEMS)[number];

export const DEDUCTION_ITEMS = ["تأخير", "غرامة", "سلفة", "خصم آخر"] as const;
export type DeductionItem = (typeof DEDUCTION_ITEMS)[number];

export const INVALID_CODE_MESSAGE = "رمز غير صحيح — اختر: ح أو غ أو ن أو إ أو م";
export const MIN_DATE = "2020-01-01";

export interface EmployeeLike {
  id?: string;
  code: string;
  name: string;
  type: string;
  monthlySalary?: number | null;
  dailyWage?: number | null;
  dailyHours?: number | null;
  hireDate?: string | null;
  endDate?: string | null;
  leavesBeforeSystem?: number | null;
  /** رصيد إجازة سنوي خاص بالموظف؛ فارغ = رصيد الإعدادات */
  annualLeave?: number | null;
  /** أيام العطلة الأسبوعية للموظف ("5" أو "5,6")؛ فارغ = عطلة الإعدادات */
  weeklyOff?: string | null;
}

export interface PayrollSettings {
  systemStartYear: number;
  weeklyOffDay: number;
  annualLeaveEntitlement: number;
  /** ساعات الدوام الرسمية اليومية — ما بعدها إضافي */
  standardHours: number;
  /** معدل الساعة الإضافية في الأيام العادية */
  overtimeRate: number;
  /** معدل ساعات العمل في العطلة الأسبوعية والإجازات الرسمية */
  holidayRate: number;
  /** خصم النقص عن ساعات الدوام (تأخير أو خروج مبكر) تلقائيًا */
  shortDeduction: boolean;
  /** مهلة السماح بالدقائق: النقص الذي لا يتجاوزها لا يُخصم */
  graceMinutes: number;
  /**
   * من هذا الشهر (YYYY-MM) يُحسب راتب الموظف الشهري حسب الأيام المدفوعة فعلًا:
   * الراتب ÷ أيام العمل (أيام الشهر عدا عطلته الأسبوعية) × الأيام المدفوعة. فارغ = حساب الإكسل.
   */
  payByAttendanceFrom: string | null;
}

export const DEFAULT_SETTINGS: PayrollSettings = {
  systemStartYear: 2026,
  weeklyOffDay: 5,
  annualLeaveEntitlement: 30,
  standardHours: 9,
  overtimeRate: 1.5,
  holidayRate: 1.5,
  shortDeduction: true,
  graceMinutes: 15,
  payByAttendanceFrom: null,
};

/** معدلات الإضافي المسموح بها في الإعدادات */
export const OVERTIME_RATES = [1.25, 1.5] as const;
export const HOLIDAY_RATES = [1.25, 1.5, 2] as const;
export const HOLIDAY_RATE_KIND = "عطلة";

// ───────────────────────── التواريخ ─────────────────────────

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function toMonthKey(year: number, month: number): string {
  return `${year}-${pad2(month)}`;
}

export function parseMonthKey(ym: string): { year: number; month: number } {
  const [y, m] = ym.split("-").map(Number);
  return { year: y, month: m };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthBounds(ym: string): { start: string; end: string; days: number } {
  const { year, month } = parseMonthKey(ym);
  const days = daysInMonth(year, month);
  return { start: `${ym}-01`, end: `${ym}-${pad2(days)}`, days };
}

export function nextMonthKey(ym: string): string {
  const { year, month } = parseMonthKey(ym);
  return month === 12 ? toMonthKey(year + 1, 1) : toMonthKey(year, month + 1);
}

/** رقم اليوم التسلسلي (أيام منذ 1970-01-01) — للمقارنة والطرح. */
export function dateSerial(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function monthOfDate(date: string): string {
  return date.slice(0, 7);
}

export const ARABIC_WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
export const ARABIC_WEEKDAYS_SHORT = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

/** هل التاريخ "YYYY-MM-DD" صالح وغير سابق لـ 01/01/2020؟ */
export function isValidDate(date: string | null | undefined): boolean {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return false;
  return date >= MIN_DATE;
}

// ───────────────────────── 3.1 من يعمل في الشهر ─────────────────────────

export function isWorkingInMonth(emp: Pick<EmployeeLike, "hireDate" | "endDate">, ym: string): boolean {
  const { start, end } = monthBounds(ym);
  const hireOk = !emp.hireDate || emp.hireDate <= end;
  const endOk = !emp.endDate || emp.endDate >= start;
  return hireOk && endOk;
}

/** الحالة: "على رأس العمل" إذا كان تاريخ الانتهاء فارغًا أو ≥ اليوم. */
export function employeeStatus(emp: Pick<EmployeeLike, "endDate">, today: string): "على رأس العمل" | "انتهت الخدمة" {
  return !emp.endDate || emp.endDate >= today ? "على رأس العمل" : "انتهت الخدمة";
}

// ───────────────────────── 3.2 العدّادات ─────────────────────────

export interface CodeCounts {
  present: number; // أيام الحضور = ح + 0.5 × ن
  absent: number;
  half: number;
  leave: number;
  sick: number;
  fullPresent: number; // عدد "ح" فقط
}

export function isValidCode(v: string | null | undefined): v is AttendanceCode {
  return !!v && (CODES as readonly string[]).includes(v);
}

export function countCodes(codes: ReadonlyArray<string | null | undefined>): CodeCounts {
  let h = 0, g = 0, n = 0, e = 0, s = 0;
  for (const c of codes) {
    if (c === "ح") h++;
    else if (c === "غ") g++;
    else if (c === "ن") n++;
    else if (c === "إ") e++;
    else if (c === "م") s++;
  }
  return { present: h + 0.5 * n, absent: g, half: n, leave: e, sick: s, fullPresent: h };
}

// ───────────────────────── 3.3 و 3.4 الراتب الأساسي ─────────────────────────

export function activeDays(emp: Pick<EmployeeLike, "hireDate" | "endDate">, ym: string): number {
  const { start, end } = monthBounds(ym);
  const last = Math.min(dateSerial(emp.endDate || end), dateSerial(end));
  const first = Math.max(dateSerial(emp.hireDate || start), dateSerial(start));
  return Math.max(last - first + 1, 0);
}

export function isDriver(emp: Pick<EmployeeLike, "type">): boolean {
  return emp.type === "سائق يومي";
}

export interface MonthlyPay {
  days: number; // D
  activeDays: number;
  salary: number; // الراتب / الأجرة المعروض
  daily: number; // الأجرة اليومية
  absenceDeduction: number; // في الحساب الجديد: قيمة أيام العمل غير المدفوعة
  due: number; // المستحق
  /** الحساب الجديد فقط: أيام العمل في الشهر (عدا العطلة الأسبوعية) والأيام المدفوعة */
  workDays?: number;
  paidDays?: number;
}

export interface AttendancePayInput {
  /** رمز كل يوم في الشهر (الفهرس = اليوم − 1) */
  codesByDay: ReadonlyArray<string | null | undefined>;
  /** أيام العطلة الأسبوعية للموظف */
  offDays: readonly number[];
  /** الإجازات الرسمية (مدفوعة) */
  holidays?: ReadonlySet<string>;
}

/** رموز الأيام المدفوعة كاملة في الحساب الجديد: حاضر، إجازة، مرضي. «ن» نصف يوم. */
export const PAID_DAY_CODES = ["ح", "إ", "م"] as const;

/**
 * الحساب حسب الأيام المدفوعة:
 *  الأجرة اليومية = الراتب ÷ أيام العمل (أيام الشهر عدا العطلة الأسبوعية للموظف)
 *  المستحق = الأجرة اليومية × الأيام المدفوعة؛ والمدفوع: ح و إ و م يوم، ن نصف يوم، والإجازة الرسمية الفارغة يوم.
 *  الغياب والخانة الفارغة لا يُدفعان، وكذلك الأيام خارج فترة عمل الموظف.
 */
function payByAttendance(emp: EmployeeLike, ym: string, salary: number, act: number, a: AttendancePayInput): MonthlyPay {
  const { days } = monthBounds(ym);
  let workDays = 0, activeWork = 0, paid = 0;
  for (let d = 1; d <= days; d++) {
    const date = `${ym}-${pad2(d)}`;
    if (a.offDays.includes(weekdayOf(date))) continue;
    workDays++;
    if ((emp.hireDate && date < emp.hireDate) || (emp.endDate && date > emp.endDate)) continue;
    activeWork++;
    const c = a.codesByDay[d - 1] || null;
    if (c && (PAID_DAY_CODES as readonly string[]).includes(c)) paid += 1;
    else if (c === "ن") paid += 0.5;
    else if (!c && a.holidays?.has(date)) paid += 1;
  }
  const daily = workDays ? salary / workDays : 0;
  const base = daily * activeWork;
  const due = daily * paid;
  return { days, activeDays: act, salary: base, daily, absenceDeduction: Math.max(base - due, 0), due, workDays, paidDays: paid };
}

export function monthlyPay(emp: EmployeeLike, ym: string, counts: CodeCounts, byAttendance?: AttendancePayInput | null): MonthlyPay {
  const { days } = monthBounds(ym);
  if (isDriver(emp)) {
    const daily = emp.dailyWage ?? 0;
    return {
      days,
      activeDays: activeDays(emp, ym),
      salary: daily * days,
      daily,
      absenceDeduction: 0,
      due: counts.present * daily,
    };
  }
  const salary = emp.monthlySalary ?? 0;
  const act = activeDays(emp, ym);
  if (byAttendance) return payByAttendance(emp, ym, salary, act, byAttendance);
  const base = (salary * act) / days;
  const daily = salary / days;
  const absenceDeduction = (counts.absent + 0.5 * counts.half) * daily;
  return { days, activeDays: act, salary: base, daily, absenceDeduction, due: Math.max(base - absenceDeduction, 0) };
}

// ───────────────────────── 3.5 الإضافي ─────────────────────────

/** الدقائق في صيغة س.د (2.30 → 30). */
export function hmMinutes(t: number): number {
  return Math.round((t - Math.floor(t)) * 100);
}

/** صيغة س.د صالحة: موجبة، ومنزلتان عشريتان على الأكثر، والدقائق 00–59. */
export function isValidHM(t: number | null | undefined): boolean {
  if (t == null || !Number.isFinite(t) || t < 0) return false;
  if (Math.abs(t * 100 - Math.round(t * 100)) > 1e-6) return false;
  return hmMinutes(t) <= 59;
}

/** INT(t) + ROUND(MOD(t,1)×100)/60 */
export function otDecimalHours(t: number): number {
  return Math.floor(t) + hmMinutes(t) / 60;
}

export function otCountedHours(t: number, rate = 1.5): number {
  return otDecimalHours(t) * rate;
}

/** معدل سطر الإضافي: معدل العطلات إن كان السطر عن عطلة، وإلا المعدل العادي. */
export function entryRate(entry: { rateKind?: string | null }, settings: Pick<PayrollSettings, "overtimeRate" | "holidayRate"> = DEFAULT_SETTINGS): number {
  return entry.rateKind === HOLIDAY_RATE_KIND ? settings.holidayRate : settings.overtimeRate;
}

type DaySettings = Pick<PayrollSettings, "weeklyOffDay" | "payByAttendanceFrom">;

/** أيام العطلة الأسبوعية للموظف: من بياناته، وإلا عطلة الإعدادات. */
export function employeeOffDays(emp: Pick<EmployeeLike, "weeklyOff"> | null | undefined, weeklyOffDay: number): number[] {
  const own = parseWeeklyOff(emp?.weeklyOff);
  return own.length ? own : [weeklyOffDay];
}

/** خيارات العطلة الأسبوعية في بيانات الموظف */
export const WEEKLY_OFF_OPTIONS = [
  { value: "5", label: "الجمعة" },
  { value: "5,6", label: "الجمعة والسبت" },
] as const;

/** "5,6" ← [5, 6]؛ القيم غير الصحيحة تُتجاهل */
export function parseWeeklyOff(v: string | null | undefined): number[] {
  if (!v) return [];
  return [...new Set(v.split(",").map((x) => Number(x.trim())).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort();
}

/** هل يُحسب راتب هذا الشهر حسب الأيام المدفوعة (موظف شهري، والشهر من بداية الحساب الجديد فما بعد). */
export function paysByAttendance(emp: EmployeeLike, ym: string, settings?: Partial<DaySettings> | null): boolean {
  const from = settings?.payByAttendanceFrom;
  return !!from && !isDriver(emp) && ym >= from;
}

/** الأجرة اليومية في تاريخ السطر: أجرة السائق، أو الراتب ÷ أيام شهر التاريخ (أو ÷ أيام العمل في الحساب الجديد). */
export function dailyOfDate(emp: EmployeeLike, date: string, settings?: DaySettings | null): number {
  if (isDriver(emp)) return emp.dailyWage ?? 0;
  const ym = date.slice(0, 7);
  if (settings && paysByAttendance(emp, ym, settings)) {
    const wd = workingDaysInMonth(ym, employeeOffDays(emp, settings.weeklyOffDay));
    return wd ? (emp.monthlySalary ?? 0) / wd : 0;
  }
  const [y, m] = date.split("-").map(Number);
  return (emp.monthlySalary ?? 0) / daysInMonth(y, m);
}

export function hourlyRate(emp: EmployeeLike, date: string, settings?: DaySettings | null): number {
  return dailyOfDate(emp, date, settings) / (emp.dailyHours || 9);
}

export function minuteCost(emp: EmployeeLike, date: string, settings?: DaySettings | null): number {
  return hourlyRate(emp, date, settings) / 60;
}

export interface ExtraLike {
  date?: string | null;
  item?: string | null;
  actualTime?: number | null;
  bonusAmount?: number | null;
  rateKind?: string | null;
}

export interface DeductionLike {
  date?: string | null;
  item?: string | null;
  lateMinutes?: number | null;
  amount?: number | null;
}

export function extraAmount(
  entry: ExtraLike,
  emp: EmployeeLike | null | undefined,
  settings: Pick<PayrollSettings, "overtimeRate" | "holidayRate"> & Partial<DaySettings> = DEFAULT_SETTINGS,
): number {
  if (!emp) return 0;
  if (entry.item === "مكافأة") return entry.bonusAmount ?? 0;
  if (!entry.date || entry.actualTime == null) return 0;
  return otCountedHours(entry.actualTime, entryRate(entry, settings)) * hourlyRate(emp, entry.date, daySettings(settings));
}

// ───────────────────────── أوقات الدوام (الدخول والخروج) ─────────────────────────

/** "08:05" ← 485 دقيقة؛ null إن كان الوقت غير صحيح */
export function parseClock(t: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h <= 23 && min <= 59 ? h * 60 + min : null;
}

/** 485 ← "08:05" */
export function formatClock(min: number): string {
  return `${pad2(Math.floor(min / 60) % 24)}:${pad2(min % 60)}`;
}

/** دقائق العمل بين الدخول والخروج (الخروج بعد منتصف الليل يُحسب في اليوم التالي). */
export function workedMinutes(checkIn: string | null | undefined, checkOut: string | null | undefined): number | null {
  const a = parseClock(checkIn);
  const b = parseClock(checkOut);
  if (a == null || b == null) return null;
  return b >= a ? b - a : b + 24 * 60 - a;
}

/** دقائق ← صيغة س.د المستخدمة في سجل الإضافي (150 ← 2.30) */
export function minutesToHM(min: number): number {
  return Math.floor(min / 60) + (min % 60) / 100;
}

export interface DayTime {
  /** دقائق العمل؛ null إن كانت البصمة ناقصة (دخول بلا خروج) */
  worked: number | null;
  /** دقائق الإضافي */
  overtime: number;
  /** دقائق النقص عن الدوام الرسمي (تأخير أو خروج مبكر) */
  short: number;
  /** يوم عطلة (أسبوعية أو رسمية): كل ساعات العمل إضافي بمعدل العطلات */
  holiday: boolean;
}

/**
 * حساب يوم من أوقات الدوام:
 *  - يوم عادي: الإضافي = ما زاد على ساعات الدوام الرسمية، والنقص = ما قلّ عنها.
 *  - يوم عطلة (أسبوعية أو رسمية): كل ساعات العمل إضافي، ولا نقص.
 */
export function dayTime(
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
  holiday: boolean,
  standardHours: number,
): DayTime {
  const worked = workedMinutes(checkIn, checkOut);
  if (worked == null) return { worked: null, overtime: 0, short: 0, holiday };
  if (holiday) return { worked, overtime: worked, short: 0, holiday };
  const std = Math.round(standardHours * 60);
  return { worked, overtime: Math.max(0, worked - std), short: Math.max(0, std - worked), holiday };
}

/** رموز الحضور التي يُخصم فيها نقص الساعات: حاضر أو لم يُسجَّل. الغياب ونصف اليوم والإجازات لها حسابها الخاص. */
export const SHORT_DEDUCTION_CODES: readonly (string | null)[] = [null, "", "ح"];

/**
 * دقائق النقص التي تُخصم: صفر إن كان الخصم متوقفًا، أو النقص ضمن مهلة السماح، أو اليوم ليس «حاضرًا».
 * إذا تجاوز النقص المهلة يُخصم كاملًا (ساعة بساعة).
 */
export function deductibleShort(
  short: number,
  settings: Pick<PayrollSettings, "shortDeduction" | "graceMinutes">,
  dayCode: string | null = null,
): number {
  if (!settings.shortDeduction || short <= 0) return 0;
  if (!SHORT_DEDUCTION_CODES.includes(dayCode)) return 0;
  return short > settings.graceMinutes ? short : 0;
}

/** هل التاريخ يوم عطلة: العطلة الأسبوعية أو إجازة رسمية. */
export function isDayOff(date: string, weeklyOff: number | readonly number[], holidays?: ReadonlySet<string>): boolean {
  const wd = weekdayOf(date);
  return (typeof weeklyOff === "number" ? wd === weeklyOff : weeklyOff.includes(wd)) || !!holidays?.has(date);
}

// ───────────────────────── 3.6 الخصومات ─────────────────────────

/** إعدادات الأيام إن وُجدت كاملة (للدوال التي تقبل إعدادات جزئية). */
function daySettings(s: Partial<DaySettings> | null | undefined): DaySettings | null {
  return s && typeof s.weeklyOffDay === "number" ? { weeklyOffDay: s.weeklyOffDay, payByAttendanceFrom: s.payByAttendanceFrom ?? null } : null;
}

export function deductionAmount(entry: DeductionLike, emp: EmployeeLike | null | undefined, settings?: Partial<DaySettings> | null): number {
  if (!emp) return 0;
  if (entry.item === "تأخير") {
    if (!entry.date) return 0;
    return (entry.lateMinutes ?? 0) * minuteCost(emp, entry.date, daySettings(settings));
  }
  return entry.amount ?? 0;
}

// ───────────────────────── حالة الربط ─────────────────────────

export type LinkKind = "empty" | "incomplete" | "unknown" | "linked";

export interface LinkStatus {
  kind: LinkKind;
  text: string;
  missing: string[];
}

export interface EntryCore {
  date?: string | null;
  hasName: boolean; // كُتب اسم (مربوط أو غير مربوط)
  item?: string | null;
  numbers: Array<number | null | undefined>; // الأرقام المُدخلة (وقت/مبلغ/دقائق)
}

export function linkStatus(core: EntryCore, employeeName: string | null | undefined): LinkStatus {
  const anyNumber = core.numbers.some((n) => n != null && n !== 0);
  if (!core.date && !core.hasName && !core.item && !anyNumber) return { kind: "empty", text: "", missing: [] };
  const missing: string[] = [];
  if (!core.date) missing.push("التاريخ");
  if (!core.hasName) missing.push("الاسم");
  if (!core.item) missing.push("البند");
  if (missing.length) return { kind: "incomplete", text: "⚠ أكمل: " + missing.join("  "), missing };
  if (!employeeName) return { kind: "unknown", text: "⚠ الاسم غير موجود في بيانات الموظفين", missing: [] };
  const [y, m] = core.date!.split("-");
  return { kind: "linked", text: `✔ مربوط بـ ${employeeName} — كشف ${m}/${y}`, missing: [] };
}

/** تنبيه: إضافي مسجّل في يوم مسجّل فيه الموظف غائبًا (لا يغيّر الحساب). */
export function extraOnAbsentDay(item: string | null | undefined, codeOnDate: string | null | undefined): boolean {
  return item === "ساعات إضافية" && codeOnDate === "غ";
}

export const ABSENT_DAY_WARNING = "⚠ الموظف مسجّل غائب في هذا اليوم";

// ───────────────────────── 3.8 الإجازات ─────────────────────────

export function yearLeaves(leaveCountInYear: number, emp: Pick<EmployeeLike, "leavesBeforeSystem">, year: number, settings: PayrollSettings): number {
  return leaveCountInYear + (year === settings.systemStartYear ? emp.leavesBeforeSystem ?? 0 : 0);
}

/** الرصيد السنوي للموظف: الخاص به إن وُجد، وإلا رصيد الإعدادات. */
export function leaveEntitlement(emp: Pick<EmployeeLike, "annualLeave"> | null | undefined, settings: PayrollSettings): number {
  return emp?.annualLeave ?? settings.annualLeaveEntitlement;
}

export function remainingLeave(taken: number, settings: PayrollSettings, emp?: Pick<EmployeeLike, "annualLeave"> | null): number {
  return leaveEntitlement(emp, settings) - taken;
}

// ───────────────────────── 3.9 نسبة الحضور (على أيام العمل بدون يوم العطلة) ─────────────────────────

/** أيام العمل في الشهر: بدون العطلة الأسبوعية والإجازات الرسمية. */
export function workingDaysInMonth(ym: string, weeklyOffDay: number | readonly number[], holidays?: ReadonlySet<string>): number {
  const { days } = monthBounds(ym);
  let n = 0;
  for (let d = 1; d <= days; d++) if (!isDayOff(`${ym}-${pad2(d)}`, weeklyOffDay, holidays)) n++;
  return n;
}

export function attendanceRate(presentDays: number, ym: string, weeklyOffDay: number | readonly number[], holidays?: ReadonlySet<string>): number {
  const wd = workingDaysInMonth(ym, weeklyOffDay, holidays);
  return wd ? presentDays / wd : 0;
}

// ───────────────────────── 3.7 الصف الشهري الكامل ─────────────────────────

export interface MonthlyRow extends MonthlyPay {
  employee: EmployeeLike;
  counts: CodeCounts;
  overtime: number;
  bonuses: number;
  deductions: number;
  net: number;
  workingDays: number;
  rate: number;
  yearLeaves: number;
  leaveRemaining: number;
}

export interface MonthlyInput {
  employee: EmployeeLike;
  ym: string;
  codes: ReadonlyArray<string | null | undefined>;
  /** سطور الإضافي المكتملة والمربوطة بالموظف وتاريخها داخل الشهر */
  extras: ExtraLike[];
  /** سطور الخصم المكتملة والمربوطة بالموظف وتاريخها داخل الشهر */
  deductions: DeductionLike[];
  /** عدد "إ" للموظف في سنة الشهر كلها */
  leaveCountInYear: number;
  settings?: PayrollSettings;
  /** الإجازات الرسمية (YYYY-MM-DD) — تُستبعد من أيام العمل */
  holidays?: ReadonlySet<string>;
  /** رمز كل يوم (الفهرس = اليوم − 1) — يلزم لحساب الراتب حسب الأيام المدفوعة */
  codesByDay?: ReadonlyArray<string | null | undefined>;
}

export function computeMonthlyRow(input: MonthlyInput): MonthlyRow {
  const settings = input.settings ?? DEFAULT_SETTINGS;
  const counts = countCodes(input.codes);
  const offDays = employeeOffDays(input.employee, settings.weeklyOffDay);
  const byAtt = paysByAttendance(input.employee, input.ym, settings)
    ? { codesByDay: input.codesByDay ?? [], offDays, holidays: input.holidays }
    : null;
  const pay = monthlyPay(input.employee, input.ym, counts, byAtt);
  let overtime = 0, bonuses = 0, deductions = 0;
  for (const x of input.extras) {
    if (x.item === "مكافأة") bonuses += extraAmount(x, input.employee, settings);
    else if (x.item === "ساعات إضافية") overtime += extraAmount(x, input.employee, settings);
  }
  for (const d of input.deductions) deductions += deductionAmount(d, input.employee, settings);
  const { year } = parseMonthKey(input.ym);
  const yl = yearLeaves(input.leaveCountInYear, input.employee, year, settings);
  return {
    ...pay,
    employee: input.employee,
    counts,
    overtime,
    bonuses,
    deductions,
    net: pay.due + overtime + bonuses - deductions,
    workingDays: workingDaysInMonth(input.ym, offDays, input.holidays),
    rate: attendanceRate(counts.present, input.ym, offDays, input.holidays),
    yearLeaves: yl,
    leaveRemaining: remainingLeave(yl, settings, input.employee),
  };
}

// ───────────────────────── 3.10 العرض ─────────────────────────

const fmt3 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const fmt0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function fmtNumber3(v: number): string {
  return fmt3.format(Object.is(Math.round(v * 1000), -0) ? 0 : v);
}

/** "ر.ع. 1,234.567" — القيمة السالبة تُعزل باتجاه LTR حتى تظهر إشارة السالب قبل الرقم في الواجهة العربية. */
export function formatOMR(v: number): string {
  const n = fmtNumber3(v);
  return n.startsWith("-") ? `ر.ع. \u2066${n}\u2069` : `ر.ع. ${n}`;
}

export function formatInt(v: number): string {
  return fmt0.format(v);
}

export function format1(v: number): string {
  return fmt1.format(v);
}

/** 0.0% */
export function formatPct(v: number): string {
  return `${fmt1.format(v * 100)}%`;
}

/** dd/mm/yyyy */
export function formatDate(date: string | null | undefined): string {
  if (!date) return "";
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

/** mm/yyyy */
export function formatMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return `${m}/${y}`;
}

export function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
