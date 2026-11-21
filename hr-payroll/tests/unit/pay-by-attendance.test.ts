import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  computeMonthlyRow,
  dailyOfDate,
  deductionAmount,
  employeeOffDays,
  extraAmount,
  hourlyRate,
  isDayOff,
  parseWeeklyOff,
  round3,
  workingDaysInMonth,
  type EmployeeLike,
} from "@/lib/payroll";

// نوفمبر 2026: 30 يومًا، الجمعة 6 و13 و20 و27، والسبت 7 و14 و21 و28
const NOV = "2026-11";
const S = { ...DEFAULT_SETTINGS, payByAttendanceFrom: NOV };
const emp = (o: Partial<EmployeeLike> = {}): EmployeeLike => ({ code: "1", name: "م", type: "موظف", monthlySalary: 260, dailyHours: 9, ...o });

/** رموز الشهر: كل أيام العمل (عدا العطلة) بالرمز code، ثم تعديلات بعض الأيام */
function month(offDays: number[], code: string | null, changes: Record<number, string | null> = {}) {
  return Array.from({ length: 30 }, (_, i) => {
    const d = i + 1;
    if (d in changes) return changes[d];
    return isDayOff(`${NOV}-${String(d).padStart(2, "0")}`, offDays) ? null : code;
  });
}

function row(e: EmployeeLike, codesByDay: (string | null)[], extra: Partial<Parameters<typeof computeMonthlyRow>[0]> = {}) {
  return computeMonthlyRow({
    employee: e, ym: NOV, codes: codesByDay, codesByDay, extras: [], deductions: [], leaveCountInYear: 0, settings: S, ...extra,
  });
}

describe("العطلة الأسبوعية للموظف", () => {
  it("قراءة القيمة، والافتراضي من الإعدادات", () => {
    expect(parseWeeklyOff("5,6")).toEqual([5, 6]);
    expect(parseWeeklyOff("9,x")).toEqual([]);
    expect(employeeOffDays(emp(), 5)).toEqual([5]);
    expect(employeeOffDays(emp({ weeklyOff: "5,6" }), 5)).toEqual([5, 6]);
  });
  it("أيام العمل: الجمعة ← 26، الجمعة والسبت ← 22", () => {
    expect(workingDaysInMonth(NOV, [5])).toBe(26);
    expect(workingDaysInMonth(NOV, [5, 6])).toBe(22);
  });
});

describe("الراتب حسب الأيام المدفوعة (الراتب ÷ أيام العمل × الأيام المدفوعة)", () => {
  it("حضور كل أيام العمل = الراتب كاملًا", () => {
    const r = row(emp(), month([5], "ح"));
    expect(r.daily).toBe(10); // 260 ÷ 26
    expect(round3(r.due)).toBe(260);
    expect(r.workDays).toBe(26);
    expect(r.paidDays).toBe(26);
  });
  it("الخانة الفارغة والغياب لا يُدفعان", () => {
    const codes = month([5], null);
    for (let d = 1; d <= 20; d++) if (codes[d - 1] === null && !isDayOff(`${NOV}-${String(d).padStart(2, "0")}`, [5])) codes[d - 1] = "ح";
    codes[21] = "غ"; // 22 نوفمبر
    const r = row(emp(), codes);
    // من 1 إلى 20 فيها 17 يوم عمل (عدا 6 و13 و20)
    expect(r.paidDays).toBe(17);
    expect(round3(r.due)).toBe(170);
    expect(round3(r.absenceDeduction)).toBe(90);
    expect(round3(r.salary)).toBe(260);
  });
  it("الإجازة والمرضي مدفوعة، ونصف اليوم نصف أجرة", () => {
    const r = row(emp(), month([5], "ح", { 2: "إ", 3: "م", 4: "ن", 5: "ن", 9: "غ" }));
    expect(r.paidDays).toBe(24); // 26 − غياب − نصفان
    expect(round3(r.due)).toBe(240);
  });
  it("الإجازة الرسمية الفارغة مدفوعة، والغياب فيها لا", () => {
    const hol = new Set(["2026-11-18"]);
    expect(row(emp(), month([5], "ح", { 18: null }), { holidays: hol }).paidDays).toBe(26);
    expect(row(emp(), month([5], "ح", { 18: "غ" }), { holidays: hol }).paidDays).toBe(25);
    expect(row(emp(), month([5], "ح", { 18: null })).paidDays).toBe(25); // بلا إجازة رسمية = لم يُسجَّل
  });
  it("العمل يوم العطلة الأسبوعية لا يُحسب يومًا مدفوعًا (يُحسب إضافيًا)", () => {
    expect(row(emp(), month([5], "ح", { 6: "ح" })).paidDays).toBe(26);
  });
  it("موظف عطلته الجمعة والسبت", () => {
    const e = emp({ monthlySalary: 220, weeklyOff: "5,6" });
    const r = row(e, month([5, 6], "ح"));
    expect(r.daily).toBe(10); // 220 ÷ 22
    expect(round3(r.due)).toBe(220);
    expect(r.workingDays).toBe(22);
    expect(r.rate).toBe(1);
  });
  it("التعيين في منتصف الشهر: الأيام قبل التعيين لا تُدفع ولا تُحسب", () => {
    const e = emp({ hireDate: "2026-11-16" });
    const r = row(e, month([5], "ح"));
    // من 16 إلى 30: 15 يومًا عدا الجمعة 20 و27 = 13
    expect(r.paidDays).toBe(13);
    expect(round3(r.salary)).toBe(130);
    expect(round3(r.due)).toBe(130);
  });
  it("الأشهر قبل البداية والسائق اليومي بالحساب القديم", () => {
    const oct = computeMonthlyRow({ employee: emp(), ym: "2026-10", codes: [], extras: [], deductions: [], leaveCountInYear: 0, settings: S });
    expect(round3(oct.due)).toBe(260); // الإكسل: الخانات الفارغة لا تُخصم
    const driver = computeMonthlyRow({
      employee: { code: "2", name: "س", type: "سائق يومي", dailyWage: 15 }, ym: NOV, codes: ["ح", "ح", "ن"], codesByDay: ["ح", "ح", "ن"],
      extras: [], deductions: [], leaveCountInYear: 0, settings: S,
    });
    expect(driver.due).toBe(37.5);
  });
  it("بدون إعداد البداية يبقى حساب الإكسل", () => {
    const r = computeMonthlyRow({ employee: emp(), ym: NOV, codes: [], codesByDay: [], extras: [], deductions: [], leaveCountInYear: 0, settings: DEFAULT_SETTINGS });
    expect(round3(r.due)).toBe(260);
  });
});

describe("أجرة الساعة في الحساب الجديد = الراتب ÷ أيام العمل ÷ 9", () => {
  it("الإضافي وخصم التأخير", () => {
    expect(dailyOfDate(emp(), "2026-11-10", S)).toBe(10);
    expect(dailyOfDate(emp(), "2026-10-10", S)).toBeCloseTo(260 / 31, 10); // قبل البداية
    expect(hourlyRate(emp(), "2026-11-10", S)).toBeCloseTo(10 / 9, 10);
    // ساعتان إضافي × 1.5 × 10/9
    expect(round3(extraAmount({ date: "2026-11-10", item: "ساعات إضافية", actualTime: 2 }, emp(), S))).toBe(3.333);
    // 90 دقيقة تأخير × 10/9/60
    expect(round3(deductionAmount({ date: "2026-11-10", item: "تأخير", lateMinutes: 90 }, emp(), S))).toBe(1.667);
  });
});
