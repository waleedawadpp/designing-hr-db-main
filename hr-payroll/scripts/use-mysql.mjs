// ينشئ مخطط MySQL/MariaDB من نفس المخطط (للنشر على Hostinger):
//  - prisma/mysql/schema.prisma : المزوّد mysql، والحقول النصية الطويلة @db.Text
//  - src/lib/mysql-init.ts      : أوامر إنشاء الجداول (تُنفَّذ عند أول تشغيل إن لم تكن الجداول موجودة)
// تشغيل: npm run db:mysql   (يتطلب prisma CLI؛ لا يحتاج اتصالًا بقاعدة بيانات)
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const LONG_TEXT = /^(\s+(?:notes|summary|before|after)\s+String\??)(\s*)$/;
const src = fs.readFileSync("prisma/schema.prisma", "utf8");
const out = src
  .replace('provider = "sqlite"', 'provider = "mysql"')
  .split("\n")
  .map((l) => (LONG_TEXT.test(l) ? l.replace(LONG_TEXT, "$1 @db.Text") : l))
  .join("\n");
fs.mkdirSync("prisma/mysql", { recursive: true });
fs.writeFileSync("prisma/mysql/schema.prisma", "// مُولَّد من prisma/schema.prisma بواسطة scripts/use-mysql.mjs — لا تعدّله يدويًا\n" + out);

if (!process.argv.includes("--schema-only")) {
  const sql = execFileSync("npx", ["prisma", "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/mysql/schema.prisma", "--script"], {
    encoding: "utf8",
  });
  fs.writeFileSync(
    "src/lib/mysql-init.ts",
    "// مُولَّد بواسطة scripts/use-mysql.mjs — لا تعدّله يدويًا\nexport const MYSQL_INIT_SQL = " + JSON.stringify(sql) + ";\n",
  );
}
console.log("✔ prisma/mysql/schema.prisma" + (process.argv.includes("--schema-only") ? "" : " و src/lib/mysql-init.ts"));
