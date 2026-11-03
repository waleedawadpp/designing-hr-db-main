// مخطط MySQL/MariaDB وترحيلاته (للنشر على Hostinger):
//  - prisma/mysql/schema.prisma       : المزوّد mysql، والحقول النصية الطويلة @db.Text / @db.LongText
//  - prisma/mysql/migrations/*.sql     : ترحيلات مرقّمة تُطبَّق مرة واحدة عند بدء الخادم
//  - src/lib/mysql-migrations.ts      : الترحيلات مضمّنة في الكود (لا يحتاج الخادم prisma CLI)
//
// الاستخدام:
//   npm run db:mysql -- --schema-only          يولّد المخطط فقط (يُستخدم أثناء البناء)
//   npm run db:mysql -- --migration <الاسم>   بعد تعديل prisma/schema.prisma: ينشئ ترحيلًا جديدًا
//                                               بالفرق بين المخطط السابق والجديد
//   npm run db:mysql                           يعيد توليد src/lib/mysql-migrations.ts فقط
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const SCHEMA = "prisma/mysql/schema.prisma";
const DIR = "prisma/mysql/migrations";
const TEXT_TYPES = { notes: "@db.Text", summary: "@db.Text", before: "@db.Text", after: "@db.Text", snapshot: "@db.LongText" };
const LINE = /^(\s+)(\w+)(\s+String\??)(\s*(?:\/\/.*)?)$/;

function buildSchema() {
  const src = fs.readFileSync("prisma/schema.prisma", "utf8");
  return (
    "// مُولَّد من prisma/schema.prisma بواسطة scripts/use-mysql.mjs — لا تعدّله يدويًا\n" +
    src
      .replace('provider = "sqlite"', 'provider = "mysql"')
      .split("\n")
      .map((l) => {
        const m = LINE.exec(l);
        return m && TEXT_TYPES[m[2]] ? `${m[1]}${m[2]}${m[3]} ${TEXT_TYPES[m[2]]}${m[4]}` : l;
      })
      .join("\n")
  );
}

function diff(fromArgs) {
  return execFileSync("npx", ["prisma", "migrate", "diff", ...fromArgs, "--to-schema-datamodel", ".mysql-next.prisma", "--script"], {
    encoding: "utf8",
  });
}

const args = process.argv.slice(2);
const next = buildSchema();
fs.mkdirSync(DIR, { recursive: true });

if (args.includes("--schema-only")) {
  fs.writeFileSync(SCHEMA, next);
  console.log("✔ " + SCHEMA);
  process.exit(0);
}

const nameIdx = args.indexOf("--migration");
if (nameIdx >= 0) {
  const name = (args[nameIdx + 1] || "").replace(/[^a-z0-9_]/gi, "_");
  if (!name) throw new Error("اكتب اسم الترحيل: --migration add_something");
  fs.writeFileSync(".mysql-next.prisma", next);
  try {
    const existing = fs.readdirSync(DIR).filter((f) => f.endsWith(".sql"));
    const sql = existing.length
      ? diff(["--from-schema-datamodel", SCHEMA])
      : diff(["--from-empty"]);
    if (!sql.replace(/--.*$/gm, "").trim()) {
      console.log("لا فرق بين المخطط السابق والجديد — لم يُنشأ ترحيل");
    } else {
      const id = String(existing.length + 1).padStart(4, "0") + "_" + name;
      fs.writeFileSync(`${DIR}/${id}.sql`, sql);
      console.log(`✔ ${DIR}/${id}.sql`);
    }
  } finally {
    fs.rmSync(".mysql-next.prisma", { force: true });
  }
  fs.writeFileSync(SCHEMA, next);
}

const migrations = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => ({ id: f.replace(/\.sql$/, ""), sql: fs.readFileSync(`${DIR}/${f}`, "utf8") }));
fs.writeFileSync(
  "src/lib/mysql-migrations.ts",
  "// مُولَّد بواسطة scripts/use-mysql.mjs من prisma/mysql/migrations — لا تعدّله يدويًا\n" +
    "export const MYSQL_MIGRATIONS: { id: string; sql: string }[] = " +
    JSON.stringify(migrations, null, 2) +
    ";\n",
);
console.log(`✔ src/lib/mysql-migrations.ts (${migrations.length} ترحيل)`);
