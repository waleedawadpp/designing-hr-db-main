// يهيئ قاعدة بيانات اختبار مؤقتة (prisma/e2e.db — للاختبار فقط) ويزرعها ثم يشغّل الخادم.
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";

const port = process.argv[2] ?? "3100";
const env = { ...process.env, DATABASE_URL: "file:./e2e.db", AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-secret-key-at-least-32-characters" };
// ملف الاختبار يُنشأ من جديد في كل تشغيل
for (const f of ["prisma/e2e.db", "prisma/e2e.db-journal"]) fs.rmSync(f, { force: true });
execSync("npx prisma db push --skip-generate", { env, stdio: "inherit" });
execSync("npx tsx prisma/seed.ts", { env, stdio: "inherit" });
const p = spawn("npx", ["next", "start", "-p", port], { env, stdio: "inherit" });
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => p.kill(s));
p.on("exit", (c) => process.exit(c ?? 0));
