import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { buildMonthlyReport } from "@/lib/report";
import { decorateDeductions, decorateExtras } from "@/lib/entries";
import { countCodes, employeeStatus, formatDate, formatMonth, monthBounds } from "@/lib/payroll";
import { currentMonthKey, todayISO } from "@/lib/utils";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Cell = string | number | null;
interface Sheet {
  title: string;
  headers: string[];
  rows: Cell[][];
  money?: number[]; // فهارس أعمدة المبالغ (3 منازل)
  pct?: number[]; // فهارس أعمدة النسب
}

const validYM = (v: string | null) => (v && /^\d{4}-\d{2}$/.test(v) ? v : null);

async function build(table: string, sp: URLSearchParams): Promise<Sheet> {
  const ym = validYM(sp.get("ym")) ?? currentMonthKey();
  switch (table) {
    case "monthly": {
      const r = await buildMonthlyReport(prisma, ym);
      const days = Array.from({ length: r.days }, (_, i) => String(i + 1));
      return {
        title: `الكشف الشهري ${formatMonth(ym)}`,
        headers: ["الرقم", "الاسم", ...days, "أيام الحضور", "غياب", "نصف يوم", "إجازة", "مرضي", "النوع", "الراتب / الأجرة", "الأجرة اليومية", "خصم الغياب", "المستحق", "الإضافي", "المكافآت", "الخصومات والغرامات", "الصافي", "إجازات السنة", "المتبقي من الرصيد"],
        rows: r.rows.map((x) => [x.employee.code, x.employee.name, ...x.codesByDay.map((c) => c ?? ""), x.counts.present, x.counts.absent, x.counts.half, x.counts.leave, x.counts.sick, x.employee.type, x.salary, x.daily, x.absenceDeduction, x.due, x.overtime, x.bonuses, x.deductions, x.net, x.yearLeaves, x.leaveRemaining]),
        money: Array.from({ length: 8 }, (_, i) => 2 + r.days + 6 + i),
      };
    }
    case "dashboard": {
      const r = await buildMonthlyReport(prisma, ym);
      return {
        title: `لوحة التحكم ${formatMonth(ym)}`,
        headers: ["#", "الرقم الوظيفي", "الاسم", "النوع", "أيام الحضور", "أيام العمل", "نسبة الحضور", "الراتب الشهري", "الأجرة المستحقة", "الإضافي والمكافآت", "الخصومات والغرامات", "الصافي"],
        rows: r.rows.map((x, i) => [i + 1, x.employee.code, x.employee.name, x.employee.type, x.counts.present, x.workingDays, x.rate, x.salary, x.due, x.overtime + x.bonuses, x.deductions, x.net]),
        money: [7, 8, 9, 10, 11],
        pct: [6],
      };
    }
    case "attendance": {
      const m = sp.get("month");
      const where = m === "all" || !validYM(m) ? { deletedAt: null } : { deletedAt: null, month: m! };
      const rows = await prisma.attendanceMonth.findMany({ where, include: { employee: true, days: true }, orderBy: [{ month: "asc" }] });
      return {
        title: "إدخال الحضور",
        headers: ["الشهر", "الرقم", "الاسم", ...Array.from({ length: 31 }, (_, i) => String(i + 1)), "حضور", "غياب", "نصف يوم", "إجازة", "مرضي", "ملاحظات"],
        rows: rows.map((r) => {
          const days: string[] = Array.from({ length: 31 }, () => "");
          for (const d of r.days) if (d.day <= monthBounds(r.month).days) days[d.day - 1] = d.code ?? "";
          const c = countCodes(days);
          return [formatMonth(r.month), r.employee.code, r.employee.name, ...days, c.present, c.absent, c.half, c.leave, c.sick, r.notes ?? ""];
        }),
      };
    }
    case "employees": {
      const list = await prisma.employee.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
      const today = todayISO();
      return {
        title: "بيانات الموظفين",
        headers: ["الرقم", "الاسم", "النوع", "الراتب الشهري", "الأجرة اليومية", "ساعات الدوام اليومي", "تاريخ التعيين", "تاريخ انتهاء الخدمة", "إجازات مسحوبة قبل النظام", "رصيد الإجازة السنوي", "الحالة", "ملاحظات"],
        rows: list.map((e) => [e.code, e.name, e.type, e.monthlySalary, e.dailyWage, e.dailyHours, formatDate(e.hireDate), formatDate(e.endDate), e.leavesBeforeSystem, e.annualLeave, employeeStatus(e, today), e.notes ?? ""]),
        money: [3, 4],
      };
    }
    case "extras":
    case "deductions": {
      const v = sp.get("ym");
      const where = validYM(v) ? { deletedAt: null, date: { gte: monthBounds(v!).start, lte: monthBounds(v!).end } } : { deletedAt: null };
      const args = { where, include: { employee: true }, orderBy: [{ date: "asc" as const }] };
      if (table === "extras") {
        const rows = await decorateExtras(prisma, await prisma.extraEntry.findMany(args));
        return {
          title: "سجل الإضافي",
          headers: ["التاريخ", "الاسم", "البند", "الوقت الفعلي (س.د)", "الساعات بالعشري", "الساعات المحتسبة ×1.5", "أجرة الساعة", "مبلغ المكافأة", "المبلغ المستحق", "الرقم", "ملاحظات", "حالة الربط"],
          rows: rows.map((x) => [formatDate(x.date), x.name, x.item, x.actualTime, x.decimalHours, x.countedHours, x.hourlyRate, x.bonusAmount, x.amount, x.code, x.notes, x.status.text + (x.warning ? ` | ${x.warning}` : "")]),
          money: [6, 7, 8],
        };
      }
      const rows = await decorateDeductions(prisma, await prisma.deductionEntry.findMany(args));
      return {
        title: "سجل الخصم",
        headers: ["التاريخ", "الاسم", "البند", "دقائق التأخير", "تكلفة الدقيقة", "مبلغ الغرامة / الخصم", "المبلغ المخصوم", "الرقم", "ملاحظات", "حالة الربط"],
        rows: rows.map((x) => [formatDate(x.date), x.name, x.item, x.lateMinutes, x.minuteCost, x.amount, x.deducted, x.code, x.notes, x.status.text]),
        money: [5, 6],
      };
    }
    default:
      throw new Error("جدول غير معروف");
  }
}

function addSheet(wb: ExcelJS.Workbook, sheet: Sheet) {
  // أسماء الأوراق في Excel لا تقبل \ / ? * [ ] : وأقصى طولها 31 حرفًا
  const ws = wb.addWorksheet(sheet.title.replace(/[\\/?*[\]:]/g, "-").slice(0, 31), { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  ws.addRow(sheet.headers);
  ws.getRow(1).eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF13294B" } };
    c.alignment = { horizontal: "center" };
  });
  for (const r of sheet.rows) ws.addRow(r);
  for (const i of sheet.money ?? []) ws.getColumn(i + 1).numFmt = "#,##0.000";
  for (const i of sheet.pct ?? []) ws.getColumn(i + 1).numFmt = "0.0%";
  ws.columns.forEach((c) => (c.width = 14));
}

/** نسخة احتياطية كاملة (للمدير): كل الجداول في ملف واحد. */
async function backupSheets(): Promise<Sheet[]> {
  const iso = (d: Date | null | undefined) => (d ? d.toISOString() : "");
  const [emps, months, extras, deds, closes, users, settings, audits] = await Promise.all([
    prisma.employee.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.attendanceMonth.findMany({ include: { employee: true, days: true }, orderBy: [{ month: "asc" }] }),
    prisma.extraEntry.findMany({ include: { employee: true }, orderBy: { date: "asc" } }),
    prisma.deductionEntry.findMany({ include: { employee: true }, orderBy: { date: "asc" } }),
    prisma.monthClose.findMany({ orderBy: { month: "asc" } }),
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.settings.findMany(),
    prisma.auditLog.findMany({ orderBy: { at: "asc" } }),
  ]);
  return [
    {
      title: "الموظفون",
      headers: ["id", "الرقم", "الاسم", "النوع", "الراتب الشهري", "الأجرة اليومية", "ساعات الدوام", "تاريخ التعيين", "تاريخ الانتهاء", "إجازات قبل النظام", "رصيد خاص", "ملاحظات"],
      rows: emps.map((e) => [e.id, e.code, e.name, e.type, e.monthlySalary, e.dailyWage, e.dailyHours, e.hireDate, e.endDate, e.leavesBeforeSystem, e.annualLeave, e.notes]),
    },
    {
      title: "الحضور",
      headers: ["الشهر", "الرقم", "الاسم", "مكرر", ...Array.from({ length: 31 }, (_, i) => String(i + 1)), "ملاحظات", "محذوف"],
      rows: months.map((m) => {
        const d: string[] = Array.from({ length: 31 }, () => "");
        for (const x of m.days) d[x.day - 1] = x.code ?? "";
        return [m.month, m.employee.code, m.employee.name, m.dupSeq, ...d, m.notes, iso(m.deletedAt)];
      }),
    },
    {
      title: "الإضافي",
      headers: ["التاريخ", "الرقم", "الاسم", "البند", "الوقت الفعلي", "مبلغ المكافأة", "ملاحظات", "محذوف"],
      rows: extras.map((x) => [x.date, x.employee?.code ?? "", x.employee?.name ?? x.rawName, x.item, x.actualTime, x.bonusAmount, x.notes, iso(x.deletedAt)]),
    },
    {
      title: "الخصم",
      headers: ["التاريخ", "الرقم", "الاسم", "البند", "دقائق التأخير", "المبلغ", "ملاحظات", "محذوف"],
      rows: deds.map((x) => [x.date, x.employee?.code ?? "", x.employee?.name ?? x.rawName, x.item, x.lateMinutes, x.amount, x.notes, iso(x.deletedAt)]),
    },
    { title: "الأشهر المعتمدة", headers: ["الشهر", "وقت الاعتماد", "بواسطة", "اللقطة JSON"], rows: closes.map((c) => [c.month, iso(c.closedAt), c.closedBy, c.snapshot]) },
    { title: "المستخدمون", headers: ["البريد", "الاسم", "الصلاحية", "معطّل منذ"], rows: users.map((u) => [u.email, u.name, u.role, iso(u.disabledAt)]) },
    { title: "الإعدادات", headers: ["رصيد الإجازة", "يوم العطلة", "سنة البداية"], rows: settings.map((x) => [x.annualLeaveEntitlement, x.weeklyOffDay, x.systemStartYear]) },
    { title: "سجل التدقيق", headers: ["الوقت", "المستخدم", "العملية", "الجدول", "المعرّف", "الوصف"], rows: audits.map((a) => [iso(a.at), a.userEmail, a.action, a.entity, a.entityId, a.summary]) },
  ];
}

async function send(wb: ExcelJS.Workbook, fileName: string) {
  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });
  const table = req.nextUrl.searchParams.get("table") ?? "";
  if (table === "backup") {
    if (user.role !== "admin") return NextResponse.json({ error: "للمدير فقط" }, { status: 403 });
    const wb = new ExcelJS.Workbook();
    for (const sh of await backupSheets()) addSheet(wb, sh);
    return send(wb, `نسخة-احتياطية-${todayISO()}.xlsx`);
  }
  let sheet: Sheet;
  try {
    sheet = await build(table, req.nextUrl.searchParams);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "خطأ" }, { status: 400 });
  }
  const wb = new ExcelJS.Workbook();
  addSheet(wb, sheet);
  return send(wb, `${sheet.title}.xlsx`);
}
