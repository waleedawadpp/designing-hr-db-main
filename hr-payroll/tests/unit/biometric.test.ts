import { describe, expect, it } from "vitest";
import { BiometricFormatError, datesBetween, parsePunchLog, planEmployee, selectedByDefault } from "@/lib/biometric";

const HEADER = ["Emp ID", "Name", "Time", "Work Code", "Attendance State", "Device Name"];

describe("parsePunchLog", () => {
  it("يجمع بصمات ZKTeco (شهر/يوم) لكل موظف ويوم ويرتب الأوقات", () => {
    const log = parsePunchLog([
      HEADER,
      ["01", "faez.sarhan", "11/01/2026 16:11:28", "0", "1", "dev"],
      ["01", "faez.sarhan", "11/01/2026 08:08:06", "0", "0", "dev"],
      ["2", "Adel", "11/16/2026 07:10:00", "0", "0", "dev"],
    ]);
    expect(log.start).toBe("2026-11-01");
    expect(log.end).toBe("2026-11-16");
    expect(log.punches).toBe(3);
    expect(log.employees.map((e) => e.deviceId)).toEqual(["01", "2"]);
    expect(log.employees[0]).toEqual({ deviceId: "01", deviceName: "faez.sarhan", days: { "2026-11-01": ["08:08", "16:11"] } });
  });

  it("يكتشف ترتيب يوم/شهر حين يكون الجزء الأول أكبر من 12", () => {
    const log = parsePunchLog([HEADER, ["5", "x", "16/11/2026 07:00", "0", "0", "d"], ["5", "x", "02/11/2026 07:00", "0", "0", "d"]]);
    expect(Object.keys(log.employees[0].days).sort()).toEqual(["2026-11-02", "2026-11-16"]);
  });

  it("يقبل صفوفًا قبل صف العناوين وخلايا تاريخ", () => {
    const log = parsePunchLog([["تقرير"], HEADER, ["7", "n", new Date(Date.UTC(2026, 10, 3, 7, 45)), "0", "0", "d"]]);
    expect(log.employees[0].days).toEqual({ "2026-11-03": ["07:45"] });
  });

  it("يرفض تقرير الملخص اليومي برسالة واضحة", () => {
    const summary = [["Emp ID", "Name", "Date", "Timetable", "Actual Work", "Required Work"], ["01", "a", "11/01/2026", "Default", "0:00", "9:00"]];
    expect(() => parsePunchLog(summary)).toThrow(BiometricFormatError);
    expect(() => parsePunchLog(summary)).toThrow(/سجل الحركات/);
  });

  it("يرفض ملفًا بلا بصمات", () => {
    expect(() => parsePunchLog([HEADER])).toThrow(/أي بصمة/);
  });
});

describe("datesBetween", () => {
  it("يشمل البداية والنهاية ويعبر الأشهر", () => {
    expect(datesBetween("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  });
});

describe("planEmployee", () => {
  const emp = { id: "e1", hireDate: null, endDate: null };
  const FRIDAY = 5; // 2026-11-06 جمعة

  it("بصمة = ح، بلا بصمة = غ، والجمعة بلا بصمة لا تُمس", () => {
    const cells = planEmployee(emp, { "2026-11-05": ["07:55"] }, {}, "2026-11-05", "2026-11-07", FRIDAY);
    expect(cells.map((c) => [c.date, c.proposed, c.kind])).toEqual([
      ["2026-11-05", "ح", "fill"],
      ["2026-11-06", null, "off"],
      ["2026-11-07", "غ", "fill"],
    ]);
    expect(cells[0].times).toEqual(["07:55"]);
  });

  it("الجمعة مع بصمة تُقترح ح إن كانت فارغة", () => {
    const [c] = planEmployee(emp, { "2026-11-06": ["08:00"] }, {}, "2026-11-06", "2026-11-06", FRIDAY);
    expect([c.proposed, c.kind]).toEqual(["ح", "fill"]);
  });

  it("لا يستبدل إ و م أبدًا، ولا ن مع وجود بصمة", () => {
    const cells = planEmployee(
      emp,
      { "2026-11-03": ["07:00"], "2026-11-04": ["07:00"] },
      { "2026-11-02": "إ", "2026-11-03": "م", "2026-11-04": "ن" },
      "2026-11-02",
      "2026-11-04",
      FRIDAY,
    );
    expect(cells.map((c) => [c.proposed, c.kind])).toEqual([
      ["إ", "kept"],
      ["م", "kept"],
      ["ن", "kept"],
    ]);
  });

  it("الرمز المطابق «same»، والمختلف «overwrite» غير محدد افتراضيًا", () => {
    const cells = planEmployee(emp, { "2026-11-02": ["07:00"] }, { "2026-11-02": "ح", "2026-11-03": "ح" }, "2026-11-02", "2026-11-03", FRIDAY);
    expect(cells.map((c) => [c.current, c.proposed, c.kind])).toEqual([
      ["ح", "ح", "same"],
      ["ح", "غ", "overwrite"],
    ]);
    expect(cells.map(selectedByDefault)).toEqual([false, false]);
  });

  it("لا يمس الأيام خارج مدة الخدمة", () => {
    const cells = planEmployee({ id: "e", hireDate: "2026-11-03", endDate: "2026-11-04" }, {}, {}, "2026-11-02", "2026-11-05", FRIDAY);
    expect(cells.map((c) => c.kind)).toEqual(["inactive", "fill", "fill", "inactive"]);
  });
});
