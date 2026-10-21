// توقيع جلسة الدخول والتحقق منها (يعمل في الخادم وفي middleware).
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "hr_session";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "viewer";
}

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET غير مضبوط (16 حرفًا على الأقل)");
  return new TextEncoder().encode(s);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { id: String(payload.id), email: String(payload.email), name: String(payload.name), role: payload.role === "admin" ? "admin" : "viewer" };
  } catch {
    return null;
  }
}
