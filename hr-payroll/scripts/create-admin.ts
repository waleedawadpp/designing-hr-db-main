// إنشاء مستخدم (مدير افتراضيًا): npm run create-admin -- email@x.com "كلمة المرور" "الاسم" [admin|viewer]
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

async function main() {
  const [email, password, name = "المدير", role = "admin"] = process.argv.slice(2);
  if (!email || !password) {
    console.error('الاستخدام: npm run create-admin -- email@example.com "password" "الاسم" [admin|viewer]');
    process.exit(1);
  }
  if (password.length < 8) throw new Error("كلمة المرور 8 أحرف على الأقل");
  if (role !== "admin" && role !== "viewer") throw new Error("الصلاحية: admin أو viewer");
  const db = new PrismaClient();
  const passwordHash = await bcrypt.hash(password, 10);
  const u = await db.user.upsert({
    where: { email: email.toLowerCase() },
    update: { passwordHash, name, role, disabledAt: null },
    create: { email: email.toLowerCase(), passwordHash, name, role },
  });
  console.log(`✔ المستخدم ${u.email} (${u.role === "admin" ? "مدير" : "مشاهد"}) جاهز`);
  await db.$disconnect();
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
