import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  HOLIDAY_RATE_KIND,
  attendanceRate,
  computeMonthlyRow,
  dayTime,
  deductibleShort,
  deductionAmount,
  entryRate,
  extraAmount,
  isDayOff,
  minutesToHM,
  otCountedHours,
  otDecimalHours,
  parseClock,
  round3,
  workedMinutes,
  workingDaysInMonth,
  type EmployeeLike,
} from "@/lib/payroll";
import { planEmployee } from "@/lib/biometric";

const emp: EmployeeLike = { code: "1", name: "م", type: "موظف", monthlySalary: 270, dailyHours: 9 }; // 30 يومًا ← 9 ر.ع يوميًا ← 1 ر.ع للساعة

describe("أوقات الدوام", () => {
  it("قراءة الوقت والتحقق منه", () => {
    expect(parseClock("08:05")).toBe(485);
    expect(parseClock("8:05")).toBe(485);
    expect(parseClock("24:00")).toBeNull();
    expect(parseClock("08:60")).toBeNull();
    expect(parseClock("")).toBeNull();
  });
  it("ساعات العمل، والخروج بعد منتصف الليل", () => {
    expect(workedMinutes("08:00", "17:00")).toBe(540);
    expect(workedMinutes("22:00", "02:30")).toBe(270);
    expect(workedMinutes("08:00", null)).toBeNull();
  });
  it("الدقائق ← صيغة س.د في سجل الإضافي", () => {
    expect(minutesToHM(150)).toBeCloseTo(2.3, 10);
    expect(minutesToHM(45)).toBeCloseTo(0.45, 10);
    expect(otDecimalHours(minutesToHM(150))).toBeCloseTo(2.5, 10);
  });
});

describe("الإضافي من الدوام (9 ساعات رسمية)", () => {
  it("يوم عادي: ما بعد 9 ساعات إضافي، والنقص للعرض فقط", () => {
    expect(dayTime("08:00", "19:30", false, 9)).toEqual({ worked: 690, overtime: 150, short: 0, holiday: false });
    expect(dayTime("08:30", "17:00", false, 9)).toEqual({ worked: 510, overtime: 0, short: 30, holiday: false });
    expect(dayTime("08:00", "17:00", false, 9)).toEqual({ worked: 540, overtime: 0, short: 0, holiday: false });
  });
  it("يوم عطلة: كل ساعات العمل إضافي ولا نقص", () => {
    expect(dayTime("09:00", "13:00", true, 9)).toEqual({ worked: 240, overtime: 240, short: 0, holiday: true });
  });
  it("بصمة ناقصة لا تُحسب", () => {
    expect(dayTime("08:00", null, false, 9)).toEqual({ worked: null, overtime: 0, short: 0, holiday: false });
  });
  it("ساعات الدوام من الإعدادات (8.5 ساعة)", () => {
    expect(dayTime("08:00", "17:00", false, 8.5).overtime).toBe(30);
  });
});

describe("معدل الإضافي من الإعدادات", () => {
  const s125 = { ...DEFAULT_SETTINGS, overtimeRate: 1.25, holidayRate: 2 };
  it("المعدل العادي ومعدل العطلات", () => {
    expect(entryRate({}, s125)).toBe(1.25);
    expect(entryRate({ rateKind: HOLIDAY_RATE_KIND }, s125)).toBe(2);
    expect(otCountedHours(2.3, 1.25)).toBeCloseTo(3.125, 10);
  });
  it("مبلغ ساعتين ونصف إضافي: بساعة وربع وبساعة ونصف", () => {
    const x = { date: "2026-11-10", item: "ساعات إضافية", actualTime: 2.3 };
    expect(round3(extraAmount(x, emp, s125))).toBe(3.125);
    expect(round3(extraAmount(x, emp))).toBe(3.75); // الافتراضي 1.5 (مطابق للإكسل)
    expect(round3(extraAmount({ ...x, rateKind: HOLIDAY_RATE_KIND }, emp, s125))).toBe(5);
  });
  it("الصافي الشهري يستخدم معدلات الإعدادات", () => {
    const row = computeMonthlyRow({
      employee: emp,
      ym: "2026-11",
      codes: [],
      extras: [{ date: "2026-11-10", item: "ساعات إضافية", actualTime: 2 }],
      deductions: [],
      leaveCountInYear: 0,
      settings: s125,
    });
    expect(round3(row.overtime)).toBe(2.5);
    expect(round3(row.net)).toBe(272.5);
  });
});

describe("الإجازات الرسمية", () => {
  const hol = new Set(["2026-11-18", "2026-11-20"]); // الأربعاء، والجمعة (عطلة أسبوعية أصلًا)
  it("عطلة أسبوعية أو رسمية", () => {
    expect(isDayOff("2026-11-18", 5, hol)).toBe(true);
    expect(isDayOff("2026-11-19", 5, hol)).toBe(false);
    expect(isDayOff("2026-11-20", 5)).toBe(true);
  });
  it("تُستبعد من أيام العمل ونسبة الحضور", () => {
    expect(workingDaysInMonth("2026-11", 5)).toBe(26);
    expect(workingDaysInMonth("2026-11", 5, hol)).toBe(25);
    expect(attendanceRate(25, "2026-11", 5, hol)).toBe(1);
  });
  it("استيراد البصمة لا يقترح غيابًا في إجازة رسمية", () => {
    const cells = planEmployee({ id: "e", hireDate: null, endDate: null }, {}, {}, "2026-11-18", "2026-11-19", 5, hol);
    expect(cells.map((c) => [c.date, c.kind, c.proposed])).toEqual([
      ["2026-11-18", "off", null],
      ["2026-11-19", "fill", "غ"],
    ]);
  });
});

describe("خصم التأخير والخروج المبكر (نقص عن 9 ساعات)", () => {
  const on = { shortDeduction: true, graceMinutes: 15 };
  it("يُخصم النقص كاملًا إذا تجاوز مهلة السماح", () => {
    const short = dayTime("08:30", "17:00", false, 9).short; // 30 دقيقة
    expect(deductibleShort(short, on)).toBe(30);
    expect(deductibleShort(short, on, "ح")).toBe(30);
  });
  it("النقص ضمن المهلة لا يُخصم، ومهلة صفر تخصم أي نقص", () => {
    expect(deductibleShort(15, on)).toBe(0);
    expect(deductibleShort(16, on)).toBe(16);
    expect(deductibleShort(5, { shortDeduction: true, graceMinutes: 0 })).toBe(5);
  });
  it("لا خصم إذا كان متوقفًا، أو في يوم عطلة، أو لرموز الغياب ونصف اليوم والإجازات", () => {
    expect(deductibleShort(60, { shortDeduction: false, graceMinutes: 0 })).toBe(0);
    expect(dayTime("09:00", "11:00", true, 9).short).toBe(0);
    for (const code of ["غ", "ن", "إ", "م"]) expect(deductibleShort(60, on, code)).toBe(0);
  });
  it("المبلغ ساعة بساعة: نصف ساعة نقص = نصف أجرة ساعة", () => {
    // 270 ر.ع ÷ 30 يومًا ÷ 9 ساعات = 1 ر.ع للساعة
    expect(round3(deductionAmount({ date: "2026-11-10", item: "تأخير", lateMinutes: 30 }, emp))).toBe(0.5);
  });
  it("الصافي الشهري: إضافي يوم وخصم نقص يوم آخر", () => {
    const row = computeMonthlyRow({
      employee: emp,
      ym: "2026-11",
      codes: [],
      extras: [{ date: "2026-11-10", item: "ساعات إضافية", actualTime: 1 }],
      deductions: [{ date: "2026-11-11", item: "تأخير", lateMinutes: 90 }],
      leaveCountInYear: 0,
      settings: DEFAULT_SETTINGS,
    });
    expect(round3(row.overtime)).toBe(1.5);
    expect(round3(row.net)).toBe(270);
  });
});
