"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { buildMonthlyReport } from "@/lib/report";
import { formatMonth } from "@/lib/payroll";

type Result = { ok: true } | { ok: false; error: string };

/** اعتماد الشهر: تُحفظ نتيجة الكشف كما هي، وتُقفل بيانات الشهر عن التعديل. */
export async function closeMonth(ym: string): Promise<Result> {
  const user = await requireAdmin();
  if (!/^\d{4}-\d{2}$/.test(ym)) return { ok: false, error: "شهر غير صحيح" };
  if (await prisma.monthClose.findUnique({ where: { month: ym } })) return { ok: false, error: "الشهر معتمد بالفعل" };
  const report = await buildMonthlyReport(prisma, ym, { live: true });
  if (!report.rows.length) return { ok: false, error: "لا يوجد عاملون في هذا الشهر" };
  await prisma.monthClose.create({ data: { month: ym, closedBy: user.email, snapshot: JSON.stringify(report) } });
  const net = report.rows.reduce((a, r) => a + r.net, 0);
  await audit(user, "create", "MonthClose", ym, `اعتماد شهر ${formatMonth(ym)} — ${report.rows.length} عاملًا، إجمالي الصافي ${net.toFixed(3)}`);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** إعادة فتح شهر معتمد (للمدير فقط، ويُسجَّل في سجل التدقيق مع اللقطة السابقة). */
export async function reopenMonth(ym: string): Promise<Result> {
  const user = await requireAdmin();
  const row = await prisma.monthClose.findUnique({ where: { month: ym } });
  if (!row) return { ok: false, error: "الشهر غير معتمد" };
  await prisma.monthClose.delete({ where: { month: ym } });
  await audit(user, "delete", "MonthClose", ym, `إعادة فتح شهر ${formatMonth(ym)} (كان معتمدًا بواسطة ${row.closedBy})`, { closedAt: row.closedAt, closedBy: row.closedBy });
  revalidatePath("/", "layout");
  return { ok: true };
}
