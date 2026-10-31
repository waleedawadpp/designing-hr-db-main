import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { SESSION_COOKIE, verifySession, type SessionUser } from "./session";

/**
 * المستخدم الحالي. يُتحقق من قاعدة البيانات في كل طلب، فيسري تعطيل المستخدم
 * أو تغيير صلاحيته فورًا دون انتظار انتهاء الجلسة.
 */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const s = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!s) return null;
  const u = await prisma.user.findUnique({ where: { id: s.id } });
  if (!u || u.disabledAt) return null;
  return { id: u.id, email: u.email, name: u.name, role: u.role === "admin" ? "admin" : "viewer" };
});

export async function requireUser(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}

/** للكتابة: المدير فقط. */
export async function requireAdmin(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) throw new Error("يجب تسجيل الدخول");
  if (u.role !== "admin") throw new Error("صلاحية المشاهد للقراءة فقط");
  return u;
}
