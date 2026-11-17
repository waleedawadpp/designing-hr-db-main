/**
 * استيراد ملف الإكسل إلى قاعدة البيانات ثم مقارنة الصافي مع الإكسل (المنطق في src/lib/xlsx-import.ts).
 *
 *   npm run import-xlsx -- path/to/file.xlsx [--reset] [--dry-run]
 *
 * يفشل (رمز خروج 1) إذا تجاوز أي فرق 0.001.
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { importWorkbook } from "../src/lib/xlsx-import";

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  if (!file || !fs.existsSync(file)) {
    console.error("الاستخدام: npm run import-xlsx -- path/to/file.xlsx [--reset] [--dry-run]");
    process.exit(2);
  }
  const db = new PrismaClient();
  try {
    const res = await importWorkbook(db, fs.readFileSync(file), {
      fileName: file,
      reset: args.includes("--reset"),
      dryRun: args.includes("--dry-run"),
    });
    for (const l of res.lines) console.log(l);
    if (!res.ok) process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error("✖", e instanceof Error ? e.message : e);
  process.exit(1);
});
