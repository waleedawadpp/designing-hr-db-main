// إيقاف مؤقت للدخول بعد عدة محاولات خاطئة لنفس البريد (حماية من تخمين كلمة المرور).
import type { PrismaClient } from "@prisma/client";

export const MAX_FAILED = 5;
export const LOCK_MINUTES = 15;

/** عدد المحاولات الخاطئة منذ آخر دخول ناجح خلال نافذة الإيقاف. */
export async function recentFailures(db: PrismaClient, email: string, now = new Date()): Promise<number> {
  const since = new Date(now.getTime() - LOCK_MINUTES * 60_000);
  const lastOk = await db.loginAttempt.findFirst({ where: { email, ok: true, at: { gte: since } }, orderBy: { at: "desc" } });
  return db.loginAttempt.count({ where: { email, ok: false, at: { gte: lastOk?.at ?? since } } });
}

export async function isLocked(db: PrismaClient, email: string): Promise<boolean> {
  return (await recentFailures(db, email)) >= MAX_FAILED;
}

export async function recordAttempt(db: PrismaClient, email: string, ok: boolean) {
  await db.loginAttempt.create({ data: { email, ok } });
  // تنظيف السجلات الأقدم من 30 يومًا
  await db.loginAttempt.deleteMany({ where: { at: { lt: new Date(Date.now() - 30 * 86_400_000) } } });
}
