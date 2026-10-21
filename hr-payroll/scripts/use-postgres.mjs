// ينشئ prisma/postgres/schema.prisma بمزوّد PostgreSQL من نفس المخطط.
import fs from "node:fs";
const src = fs.readFileSync("prisma/schema.prisma", "utf8");
const out = src.replace('provider = "sqlite"', 'provider = "postgresql"');
fs.mkdirSync("prisma/postgres", { recursive: true });
fs.writeFileSync("prisma/postgres/schema.prisma", out);
console.log("✔ prisma/postgres/schema.prisma — استخدم: npx prisma db push --schema prisma/postgres/schema.prisma");
