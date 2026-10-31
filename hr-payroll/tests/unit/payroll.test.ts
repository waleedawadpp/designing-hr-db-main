import { describe, expect, it } from "vitest";
import {
  activeDays,
  attendanceRate,
  computeMonthlyRow,
  countCodes,
  deductionAmount,
  employeeStatus,
  extraAmount,
  extraOnAbsentDay,
  formatDate,
  formatMonth,
  formatOMR,
  formatPct,
  hourlyRate,
  isValidCode,
  isValidDate,
  isValidHM,
  isWorkingInMonth,
  linkStatus,
  minuteCost,
  monthBounds,
  monthlyPay,
  nextMonthKey,
  otCountedHours,
  otDecimalHours,
  remainingLeave,
  round3,
  workingDaysInMonth,
  yearLeaves,
  DEFAULT_SETTINGS,
  type EmployeeLike,
} from "@/lib/payroll";

const emp = (o: Partial<EmployeeLike> = {}): EmployeeLike => ({
  code: "622001",
  name: "موظف تجريبي",
  type: "موظف",
  monthlySalary: 1000,
  dailyHours: 9,
  ...o,
});
const driver = (o: Partial<EmployeeLike> = {}): EmployeeLike => ({
  code: "D001",
  name: "سايق 1",
  type: "سائق يومي",
  dailyWage: 15,
  dailyHours: 9,
  ...o,
});

/** أيام شهر برموز محددة: مثال codes({ ن: 3 }) */
function codes(spec: Partial<Record<"ح" | "غ" | "ن" | "إ" | "م", number>>): string[] {
  const out: string[] = [];
  for (const [k, n] of Object.entries(spec)) for (let i = 0; i < (n ?? 0); i++) out.push(k);
  return out;
}

const NOV = "2026-11"; // 30 يومًا
const OCT = "2026-10"; // 31 يومًا

describe("الاختبارات الإلزامية", () => {
  it("موظف 1000 في شهر 30 يومًا، 3 ن وإضافي 8.333 → الصافي 958.333", () => {
    // إضافي 1.30 ساعة = 1.5 عشري × 1.5 = 2.25 محتسبة × (1000/30/9) = 8.333
    const row = computeMonthlyRow({
      employee: emp({ monthlySalary: 1000 }),
      ym: NOV,
      codes: codes({ ن: 3 }),
      extras: [{ date: "2026-11-09", item: "ساعات إضافية", actualTime: 1.3 }],
      deductions: [],
      leaveCountInYear: 0,
    });
    expect(round3(row.absenceDeduction)).toBe(50);
    expect(round3(row.overtime)).toBe(8.333);
    expect(round3(row.net)).toBe(958.333);
  });

  it("موظف 200 في شهر 30 يومًا، 1 غ و3 ن وسلفة 30 → خصم الغياب 16.667 والصافي 153.333", () => {
    const row = computeMonthlyRow({
      employee: emp({ monthlySalary: 200 }),
      ym: NOV,
      codes: codes({ غ: 1, ن: 3 }),
      extras: [],
      deductions: [{ date: "2026-11-10", item: "سلفة", amount: 30 }],
      leaveCountInYear: 0,
    });
    expect(round3(row.absenceDeduction)).toBe(16.667);
    expect(round3(row.net)).toBe(153.333);
  });

  it("سائق 15 يوميًا، 22.5 يوم حضور وإضافي 6.875 ومكافأة 10 → الصافي 354.375", () => {
    const d = driver();
    const counts = countCodes(codes({ ح: 22, ن: 1 }));
    expect(counts.present).toBe(22.5);
    const pay = monthlyPay(d, NOV, counts);
    expect(pay.absenceDeduction).toBe(0);
    expect(pay.salary).toBe(15 * 30);
    // إضافي 6.875 = 3.666.. ساعة × (15/9)؛ نستخدم وقتًا يعطي 6.875: 2.45 → 2.75 ساعة → 4.125 محتسبة × 1.6667 = 6.875
    const ot = extraAmount({ date: "2026-11-05", item: "ساعات إضافية", actualTime: 2.45 }, d);
    expect(round3(ot)).toBe(6.875);
    const row = computeMonthlyRow({
      employee: d,
      ym: NOV,
      codes: codes({ ح: 22, ن: 1 }),
      extras: [
        { date: "2026-11-05", item: "ساعات إضافية", actualTime: 2.45 },
        { date: "2026-11-06", item: "مكافأة", bonusAmount: 10 },
      ],
      deductions: [],
      leaveCountInYear: 0,
    });
    expect(round3(row.net)).toBe(354.375);
  });

  it("موظف 150 في أكتوبر (31 يومًا): 1 غ و1 ن وإضافي 2.30 ومكافأة 20 وتأخير 30 دقيقة وغرامة 5 → 159.489", () => {
    const row = computeMonthlyRow({
      employee: emp({ monthlySalary: 150 }),
      ym: OCT,
      codes: codes({ غ: 1, ن: 1, ح: 20 }),
      extras: [
        { date: "2026-10-12", item: "ساعات إضافية", actualTime: 2.3 },
        { date: "2026-10-13", item: "مكافأة", bonusAmount: 20 },
      ],
      deductions: [
        { date: "2026-10-14", item: "تأخير", lateMinutes: 30 },
        { date: "2026-10-15", item: "غرامة", amount: 5 },
      ],
      leaveCountInYear: 0,
    });
    expect(round3(row.absenceDeduction)).toBe(7.258);
    expect(round3(row.overtime)).toBe(2.016);
    expect(round3(deductionAmount({ date: "2026-10-14", item: "تأخير", lateMinutes: 30 }, emp({ monthlySalary: 150 })))).toBe(0.269);
    expect(round3(row.bonuses)).toBe(20);
    expect(round3(row.net)).toBe(159.489);
  });

  it("إضافي 2.30 = 2.50 ساعة بالعشري = 3.75 ساعة محتسبة", () => {
    expect(otDecimalHours(2.3)).toBeCloseTo(2.5, 12);
    expect(otCountedHours(2.3)).toBeCloseTo(3.75, 12);
  });

  it("موظف تعيينه 15/11 يظهر في نوفمبر لا أكتوبر، وراتبه بنسبة الأيام 15–30", () => {
    const e = emp({ monthlySalary: 1000, hireDate: "2026-11-15" });
    expect(isWorkingInMonth(e, OCT)).toBe(false);
    expect(isWorkingInMonth(e, NOV)).toBe(true);
    expect(activeDays(e, NOV)).toBe(16);
    const pay = monthlyPay(e, NOV, countCodes([]));
    expect(round3(pay.salary)).toBe(round3((1000 * 16) / 30));
    expect(round3(pay.due)).toBe(533.333);
  });
});

describe("3.1 من يعمل في الشهر", () => {
  it("بلا تواريخ يعمل في كل الأشهر", () => {
    expect(isWorkingInMonth({}, "2040-02")).toBe(true);
  });
  it("انتهت خدمته قبل بداية الشهر لا يظهر", () => {
    expect(isWorkingInMonth({ endDate: "2026-09-30" }, OCT)).toBe(false);
    expect(isWorkingInMonth({ endDate: "2026-10-01" }, OCT)).toBe(true);
  });
  it("تعيينه آخر يوم في الشهر يظهر", () => {
    expect(isWorkingInMonth({ hireDate: "2026-10-31" }, OCT)).toBe(true);
    expect(isWorkingInMonth({ hireDate: "2026-11-01" }, OCT)).toBe(false);
  });
  it("الحالة محسوبة من تاريخ الانتهاء", () => {
    expect(employeeStatus({ endDate: null }, "2026-10-21")).toBe("على رأس العمل");
    expect(employeeStatus({ endDate: "2026-10-21" }, "2026-10-21")).toBe("على رأس العمل");
    expect(employeeStatus({ endDate: "2026-10-20" }, "2026-10-21")).toBe("انتهت الخدمة");
  });
});

describe("3.2 العدّادات", () => {
  it("أيام الحضور = ح + 0.5 × ن، والباقي عدّ مباشر", () => {
    const c = countCodes(["ح", "ح", "ن", "غ", "إ", "م", "م", null, "", "x"]);
    expect(c).toEqual({ present: 2.5, absent: 1, half: 1, leave: 1, sick: 2, fullPresent: 2 });
  });
  it("قبول الرموز الخمسة فقط", () => {
    for (const c of ["ح", "غ", "ن", "إ", "م"]) expect(isValidCode(c)).toBe(true);
    for (const c of ["ا", "h", "", null, "حح"]) expect(isValidCode(c)).toBe(false);
  });
});

describe("3.3 الموظف", () => {
  it("الفارغ والإجازة والمرضي مدفوعة، ويُخصم غ و ن فقط", () => {
    const pay = monthlyPay(emp({ monthlySalary: 310 }), OCT, countCodes(codes({ إ: 5, م: 3 })));
    expect(pay.absenceDeduction).toBe(0);
    expect(pay.due).toBe(310);
  });
  it("المستحق لا ينزل عن صفر", () => {
    const e = emp({ monthlySalary: 300, hireDate: "2026-11-25" }); // 6 أيام فقط
    const pay = monthlyPay(e, NOV, countCodes(codes({ غ: 20 })));
    expect(pay.due).toBe(0);
  });
  it("انتهاء الخدمة منتصف الشهر يحسب بالنسبة", () => {
    const e = emp({ monthlySalary: 310, endDate: "2026-10-10" });
    expect(activeDays(e, OCT)).toBe(10);
    expect(monthlyPay(e, OCT, countCodes([])).salary).toBeCloseTo(100, 10);
  });
  it("activeDays لا يقل عن 0", () => {
    expect(activeDays({ hireDate: "2026-12-01" }, OCT)).toBe(0);
  });
  it("الأجرة اليومية = الراتب ÷ أيام الشهر", () => {
    expect(monthlyPay(emp({ monthlySalary: 280 }), "2026-02", countCodes([])).daily).toBe(10);
  });
});

describe("3.4 السائق اليومي", () => {
  it("الراتب المعروض = الأجرة × D، والمستحق = أيام الحضور × الأجرة", () => {
    const pay = monthlyPay(driver(), OCT, countCodes(codes({ ح: 20, غ: 5, ن: 2 })));
    expect(pay.salary).toBe(465);
    expect(pay.absenceDeduction).toBe(0);
    expect(pay.due).toBe(21 * 15);
  });
});

describe("3.5 الإضافي", () => {
  it("تحويل س.د إلى عشري", () => {
    expect(otDecimalHours(1.3)).toBeCloseTo(1.5, 12);
    expect(otDecimalHours(0.45)).toBeCloseTo(0.75, 12);
    expect(otDecimalHours(3)).toBe(3);
    expect(otDecimalHours(1.59)).toBeCloseTo(1 + 59 / 60, 12);
  });
  it("الدقائق من 00 إلى 59 فقط", () => {
    expect(isValidHM(2.3)).toBe(true);
    expect(isValidHM(2.59)).toBe(true);
    expect(isValidHM(2.6)).toBe(false);
    expect(isValidHM(2.75)).toBe(false);
    expect(isValidHM(2.305)).toBe(false);
    expect(isValidHM(-1)).toBe(false);
  });
  it("أجرة الساعة: السائق من الأجرة اليومية، والموظف من أيام شهر تاريخ السطر", () => {
    expect(hourlyRate(driver(), "2026-10-01")).toBeCloseTo(15 / 9, 12);
    expect(hourlyRate(emp({ monthlySalary: 280 }), "2026-02-10")).toBeCloseTo(10 / 9, 12);
    expect(hourlyRate(emp({ monthlySalary: 310, dailyHours: 8 }), "2026-10-10")).toBeCloseTo(10 / 8, 12);
  });
  it("المكافأة = المبلغ، والإضافي = المحتسبة × أجرة الساعة", () => {
    expect(extraAmount({ date: "2026-10-01", item: "مكافأة", bonusAmount: 12.5, actualTime: 4 }, emp())).toBe(12.5);
    expect(extraAmount({ date: "2026-10-01", item: "ساعات إضافية", actualTime: 1 }, driver())).toBeCloseTo(1.5 * (15 / 9), 12);
  });
  it("تنبيه الإضافي في يوم غياب", () => {
    expect(extraOnAbsentDay("ساعات إضافية", "غ")).toBe(true);
    expect(extraOnAbsentDay("ساعات إضافية", "ح")).toBe(false);
    expect(extraOnAbsentDay("مكافأة", "غ")).toBe(false);
  });
});

describe("3.6 الخصومات", () => {
  it("تكلفة الدقيقة = الأجرة اليومية ÷ الساعات ÷ 60", () => {
    expect(minuteCost(emp({ monthlySalary: 350 }), "2026-10-21")).toBeCloseTo(350 / 31 / 9 / 60, 15);
  });
  it("مطابقة سطر الإكسل: 150 دقيقة تأخير براتب 350 في أكتوبر = 3.136", () => {
    expect(round3(deductionAmount({ date: "2026-10-21", item: "تأخير", lateMinutes: 150, amount: 150 }, emp({ monthlySalary: 350 })))).toBe(3.136);
  });
  it("غير التأخير = المبلغ مباشرة", () => {
    for (const item of ["غرامة", "سلفة", "خصم آخر"]) {
      expect(deductionAmount({ date: "2026-10-21", item, amount: 7, lateMinutes: 99 }, emp())).toBe(7);
    }
  });
});

describe("3.7 الصافي", () => {
  it("الصافي = المستحق + الإضافي + المكافآت − الخصومات", () => {
    const row = computeMonthlyRow({
      employee: emp({ monthlySalary: 310 }),
      ym: OCT,
      codes: codes({ غ: 1 }),
      extras: [{ date: "2026-10-02", item: "مكافأة", bonusAmount: 5 }],
      deductions: [{ date: "2026-10-03", item: "خصم آخر", amount: 2 }],
      leaveCountInYear: 0,
    });
    expect(row.net).toBeCloseTo(310 - 10 + 5 - 2, 10);
  });
  it("السلفة تُخصم كاملة في شهرها", () => {
    const row = computeMonthlyRow({
      employee: emp({ monthlySalary: 500 }),
      ym: NOV,
      codes: [],
      extras: [],
      deductions: [{ date: "2026-11-01", item: "سلفة", amount: 300 }],
      leaveCountInYear: 0,
    });
    expect(row.net).toBe(200);
  });
});

describe("3.8 إجازات السنة والرصيد", () => {
  it("تُضاف الإجازات قبل النظام في سنة البداية فقط", () => {
    expect(yearLeaves(4, { leavesBeforeSystem: 6 }, 2026, DEFAULT_SETTINGS)).toBe(10);
    expect(yearLeaves(4, { leavesBeforeSystem: 6 }, 2027, DEFAULT_SETTINGS)).toBe(4);
    expect(yearLeaves(4, { leavesBeforeSystem: null }, 2026, DEFAULT_SETTINGS)).toBe(4);
  });
  it("المتبقي = 30 − المسحوب", () => {
    expect(remainingLeave(10, DEFAULT_SETTINGS)).toBe(20);
  });
  it("رصيد خاص بالموظف يتقدّم على رصيد الإعدادات", () => {
    expect(remainingLeave(10, DEFAULT_SETTINGS, { annualLeave: 21 })).toBe(11);
    expect(remainingLeave(10, DEFAULT_SETTINGS, { annualLeave: null })).toBe(20);
  });
});

describe("3.9 نسبة الحضور على أيام العمل بدون الجمعة", () => {
  it("أكتوبر 2026 فيه 5 جمع → 26 يوم عمل", () => {
    expect(workingDaysInMonth(OCT, 5)).toBe(26);
    expect(workingDaysInMonth(NOV, 5)).toBe(26);
    expect(workingDaysInMonth("2026-02", 5)).toBe(24);
  });
  it("النسبة = أيام الحضور ÷ أيام العمل", () => {
    expect(attendanceRate(13, OCT, 5)).toBe(0.5);
    expect(formatPct(attendanceRate(24.5, OCT, 5))).toBe("94.2%");
  });
});

describe("حالة الربط", () => {
  const core = { date: "2026-10-05", hasName: true, item: "مكافأة", numbers: [10] };
  it("السطر الفارغ لا يظهر شيئًا", () => {
    expect(linkStatus({ date: null, hasName: false, item: null, numbers: [null, 0] }, null).kind).toBe("empty");
  });
  it("الحقول الناقصة", () => {
    const s = linkStatus({ ...core, date: null, item: null }, "س");
    expect(s.kind).toBe("incomplete");
    expect(s.text).toBe("⚠ أكمل: التاريخ  البند");
  });
  it("الاسم غير موجود", () => {
    expect(linkStatus(core, null).text).toBe("⚠ الاسم غير موجود في بيانات الموظفين");
  });
  it("مربوط", () => {
    expect(linkStatus(core, "عادل").text).toBe("✔ مربوط بـ عادل — كشف 10/2026");
  });
});

describe("العرض والتواريخ", () => {
  it("العملة بثلاث منازل", () => {
    expect(formatOMR(1234.5671)).toBe("ر.ع. 1,234.567");
    expect(formatOMR(0)).toBe("ر.ع. 0.000");
    expect(formatOMR(-0.0001)).toBe("ر.ع. 0.000");
    expect(formatOMR(-16.129)).toBe("ر.ع. \u2066-16.129\u2069");
  });
  it("التاريخ والشهر", () => {
    expect(formatDate("2026-11-05")).toBe("05/11/2026");
    expect(formatMonth("2026-11")).toBe("11/2026");
  });
  it("حدود الشهر والشهر التالي حتى 2060", () => {
    expect(monthBounds("2028-02")).toEqual({ start: "2028-02-01", end: "2028-02-29", days: 29 });
    expect(nextMonthKey("2026-12")).toBe("2027-01");
    expect(monthBounds("2060-12").days).toBe(31);
  });
  it("لا تواريخ قبل 01/01/2020", () => {
    expect(isValidDate("2019-12-31")).toBe(false);
    expect(isValidDate("2020-01-01")).toBe(true);
    expect(isValidDate("2026-02-30")).toBe(false);
  });
});
