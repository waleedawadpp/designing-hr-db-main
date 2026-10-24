// بيانات تجريبية: 25 موظفًا و3 سواق، وشهر كامل (10/2026) بحالات عشوائية ثابتة،
// مع أسطر إضافي ومكافآت وخصومات، ومستخدمَين: مدير ومشاهد.
// تشغيل: npm run db:seed   (يمسح البيانات الحالية في قاعدة التطوير فقط)
import bcrypt from "bcryptjs";
import { PrismaClient, type Employee } from "@prisma/client";
import { daysInMonth, pad2, weekdayOf } from "../src/lib/payroll";

const db = new PrismaClient();
const MONTH = "2026-10";

// مولّد عشوائي ثابت (mulberry32) لنتائج قابلة للتكرار
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(2026);

const NAMES = [
  "أحمد سالم البلوشي", "خالد محمد الحارثي", "سعيد ناصر الكندي", "يوسف علي الهنائي", "محمود حسن الشكيلي",
  "عبدالله راشد المعمري", "ماجد سيف الرواحي", "حمد خلفان السيابي", "طارق عيسى الفارسي", "سالم مبارك الغافري",
  "نبيل أحمد الزدجالي", "فهد عبدالرحمن العامري", "إبراهيم يعقوب الوهيبي", "مازن هلال البوسعيدي", "زاهر حمود الريامي",
  "بدر سليمان الجابري", "هيثم مسعود العبري", "وائل جمعة الشامسي", "عمر خميس النعماني", "كريم فيصل المحروقي",
  "رامي عادل القاسمي", "جاسم حارب السعدي", "منصور عوض المقبالي", "حاتم صالح الحوسني", "أنس مراد اللواتي",
];
const SALARIES = [1000, 150, 200, 150, 240, 200, 1000, 200, 150, 150, 800, 500, 300, 200, 200, 200, 240, 400, 200, 150, 350, 200, 240, 240, 240];

async function main() {
  await db.auditLog.deleteMany();
  await db.attendanceDay.deleteMany();
  await db.attendanceMonth.deleteMany();
  await db.extraEntry.deleteMany();
  await db.deductionEntry.deleteMany();
  await db.employee.deleteMany();
  await db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  for (const [email, name, role, pw] of [
    ["admin@example.com", "المدير", "admin", "Admin@12345"],
    ["viewer@example.com", "المشاهد", "viewer", "Viewer@12345"],
  ]) {
    const passwordHash = await bcrypt.hash(pw, 10);
    await db.user.upsert({ where: { email }, update: { passwordHash, name, role }, create: { email, name, role, passwordHash } });
  }

  const employees: Employee[] = [];
  for (let i = 0; i < NAMES.length; i++) {
    employees.push(
      await db.employee.create({
        data: {
          code: String(622001 + i),
          name: NAMES[i],
          type: "موظف",
          monthlySalary: SALARIES[i],
          dailyHours: 9,
          leavesBeforeSystem: i % 7 === 0 ? 5 : null,
          sortOrder: i + 1,
        },
      }),
    );
  }
  for (let i = 1; i <= 3; i++) {
    employees.push(
      await db.employee.create({
        data: { code: `D00${i}`, name: `سايق ${i}`, type: "سائق يومي", dailyWage: 15, dailyHours: 9, sortOrder: 100 + i },
      }),
    );
  }

  const D = daysInMonth(2026, 10);
  for (const e of employees) {
    const row = await db.attendanceMonth.create({ data: { employeeId: e.id, month: MONTH } });
    const days = [];
    for (let d = 1; d <= D; d++) {
      const date = `${MONTH}-${pad2(d)}`;
      if (weekdayOf(date) === 5) continue; // الجمعة غير مسجّلة
      const x = rand();
      const code = x < 0.82 ? "ح" : x < 0.88 ? "غ" : x < 0.93 ? "ن" : x < 0.97 ? "إ" : "م";
      days.push({ monthId: row.id, day: d, code });
    }
    await db.attendanceDay.createMany({ data: days });
  }

  const pick = () => employees[Math.floor(rand() * employees.length)];
  for (let i = 0; i < 10; i++) {
    const e = pick();
    const day = 1 + Math.floor(rand() * 28);
    const isBonus = i % 3 === 0;
    await db.extraEntry.create({
      data: {
        date: `${MONTH}-${pad2(day)}`,
        employeeId: e.id,
        item: isBonus ? "مكافأة" : "ساعات إضافية",
        actualTime: isBonus ? null : [1.3, 2.0, 2.3, 0.45, 3.15][i % 5],
        bonusAmount: isBonus ? [10, 20, 15][i % 3] : null,
      },
    });
  }
  // سطر ناقص (بلا تاريخ) لإظهار حالة الربط
  await db.extraEntry.create({ data: { employeeId: employees[4].id, item: "مكافأة", bonusAmount: 10 } });

  const items = ["تأخير", "غرامة", "سلفة", "خصم آخر"] as const;
  for (let i = 0; i < 8; i++) {
    const e = pick();
    const item = items[i % 4];
    await db.deductionEntry.create({
      data: {
        date: `${MONTH}-${pad2(1 + Math.floor(rand() * 28))}`,
        employeeId: e.id,
        item,
        lateMinutes: item === "تأخير" ? [15, 30, 45, 150][i % 4] : null,
        amount: item === "تأخير" ? null : [5, 30, 10, 2][i % 4],
      },
    });
  }

  console.log(`✔ seed: ${employees.length} عاملًا، شهر ${MONTH}`);
  console.log("  مدير: admin@example.com / Admin@12345");
  console.log("  مشاهد: viewer@example.com / Viewer@12345");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
