// يعمل مرة واحدة عند بدء الخادم (من instrumentation.ts) على MySQL فقط:
//  1) يطبّق ترحيلات prisma/mysql/migrations التي لم تُطبَّق بعد (لا يحتاج الخادم إلى prisma CLI)
//  2) ينشئ أول مدير من BOOTSTRAP_ADMIN_EMAIL و BOOTSTRAP_ADMIN_PASSWORD إن لم يوجد أي مستخدم
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { MYSQL_MIGRATIONS } from "./mysql-migrations";

const BASELINE = "0001_init";

async function tableExists(name: string) {
  const rows = await prisma.$queryRawUnsafe<{ n: bigint | number }[]>(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
    name,
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

function statements(sql: string) {
  return sql
    .split(/;\s*\n/)
    .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);
}

export async function migrateMysql() {
  await prisma.$executeRawUnsafe(
    "CREATE TABLE IF NOT EXISTS `_app_migrations` (`id` VARCHAR(191) NOT NULL PRIMARY KEY, `appliedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)) DEFAULT CHARACTER SET utf8mb4",
  );
  const applied = new Set(
    (await prisma.$queryRawUnsafe<{ id: string }[]>("SELECT id FROM `_app_migrations`")).map((r) => r.id),
  );
  // قاعدة أُنشئت قبل نظام الترحيلات: جداولها الأولى موجودة، فنعدّ الترحيل الأول مطبَّقًا
  if (!applied.has(BASELINE) && (await tableExists("Employee"))) {
    await prisma.$executeRawUnsafe("INSERT INTO `_app_migrations` (id) VALUES (?)", BASELINE);
    applied.add(BASELINE);
  }
  for (const m of MYSQL_MIGRATIONS) {
    if (applied.has(m.id)) continue;
    const list = statements(m.sql);
    for (const s of list) await prisma.$executeRawUnsafe(s);
    await prisma.$executeRawUnsafe("INSERT INTO `_app_migrations` (id) VALUES (?)", m.id);
    console.log(`✔ bootstrap: طُبّق الترحيل ${m.id} (${list.length} أمر)`);
  }
}

export async function bootstrapDatabase() {
  if (!process.env.DATABASE_URL?.startsWith("mysql")) return;
  await migrateMysql();
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
