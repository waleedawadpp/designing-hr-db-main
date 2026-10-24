import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession, type SessionUser } from "./session";

export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

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
