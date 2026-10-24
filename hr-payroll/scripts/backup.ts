// نسخة احتياطية لقاعدة البيانات: npm run backup
//  - SQLite: نسخة متسقة عبر VACUUM INTO إلى backups/hr-YYYY-MM-DD.db
//  - PostgreSQL: pg_dump مضغوط إلى backups/hr-YYYY-MM-DD.dump
// يحتفظ بآخر 30 نسخة. للجدولة اليومية: GitHub Actions (.github/workflows/hr-payroll-backup.yml) أو cron.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const KEEP = 30;

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const dir = process.env.BACKUP_DIR ?? "backups";
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  let out: string;
  if (url.startsWith("file:")) {
    out = path.resolve(dir, `hr-${stamp}.db`);
    fs.rmSync(out, { force: true });
    const db = new PrismaClient();
    await db.$executeRawUnsafe(`VACUUM INTO '${out.replace(/'/g, "''")}'`);
    await db.$disconnect();
  } else if (/^postgres(ql)?:\/\//.test(url)) {
    out = path.resolve(dir, `hr-${stamp}.dump`);
    execFileSync("pg_dump", ["--format=custom", "--no-owner", `--file=${out}`, url], { stdio: "inherit" });
  } else {
    throw new Error("DATABASE_URL غير مدعوم للنسخ الاحتياطي");
  }
  const files = fs.readdirSync(dir).filter((f) => /^hr-\d{4}-\d{2}-\d{2}\.(db|dump)$/.test(f)).sort();
  for (const f of files.slice(0, Math.max(0, files.length - KEEP))) fs.rmSync(path.join(dir, f));
  console.log(`✔ نسخة احتياطية: ${out}`);
}

main().catch((e) => {
  console.error("✖", e instanceof Error ? e.message : e);
  process.exit(1);
});
