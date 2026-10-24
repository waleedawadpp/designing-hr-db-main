// يعمل مرة واحدة عند بدء الخادم (من instrumentation.ts) على MySQL فقط:
//  1) ينشئ الجداول إن كانت القاعدة فارغة (لا يحتاج الخادم إلى prisma CLI)
//  2) ينشئ أول مدير من BOOTSTRAP_ADMIN_EMAIL و BOOTSTRAP_ADMIN_PASSWORD إن لم يوجد أي مستخدم
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { MYSQL_INIT_SQL } from "./mysql-init";

export async function bootstrapDatabase() {
  if (!process.env.DATABASE_URL?.startsWith("mysql")) return;
  const rows = await prisma.$queryRawUnsafe<{ n: bigint | number }[]>(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'Employee'",
  );
  if (Number(rows[0]?.n ?? 0) === 0) {
    const statements = MYSQL_INIT_SQL.split(/;\s*\n/)
      .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
      .filter(Boolean);
    for (const s of statements) await prisma.$executeRawUnsafe(s);
    console.log(`✔ bootstrap: أُنشئت الجداول (${statements.length} أمر)`);
  }
  await prisma.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (email && password && (await prisma.user.count()) === 0) {
    await prisma.user.create({
      data: { email, name: process.env.BOOTSTRAP_ADMIN_NAME || "المدير", role: "admin", passwordHash: await bcrypt.hash(password, 10) },
    });
    console.log(`✔ bootstrap: أُنشئ المدير ${email}`);
  }
}
