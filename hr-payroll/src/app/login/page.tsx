import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, signSession } from "@/lib/session";

async function login(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.disabledAt || !(await bcrypt.compare(password, user.passwordHash))) {
    redirect("/login?error=1");
  }
  const token = await signSession({ id: user.id, email: user.email, name: user.name, role: user.role === "admin" ? "admin" : "viewer" });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 12 * 3600,
  });
  redirect("/");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form action={login} className="w-full max-w-sm overflow-hidden rounded-lg border border-line bg-white shadow">
        <div className="border-b-2 border-gold bg-navy px-5 py-4 text-lg font-bold text-white">تسجيل الدخول — نظام الحضور والرواتب</div>
        <div className="bg-cream px-5 py-2 text-sm text-slate-700">أدخل البريد الإلكتروني وكلمة المرور</div>
        <div className="space-y-3 p-5">
          {sp.error && <div className="rounded bg-[#FEE2E2] px-3 py-2 text-sm text-[#B91C1C]">البريد أو كلمة المرور غير صحيحة</div>}
          <label className="block text-sm">
            البريد الإلكتروني
            <input name="email" type="email" required dir="ltr" className="mt-1 w-full rounded border border-line px-3 py-2 text-[#0000FF]" />
          </label>
          <label className="block text-sm">
            كلمة المرور
            <input name="password" type="password" required dir="ltr" className="mt-1 w-full rounded border border-line px-3 py-2 text-[#0000FF]" />
          </label>
          <button className="w-full rounded bg-navy py-2 font-semibold text-white hover:bg-navy-2">دخول</button>
        </div>
      </form>
    </div>
  );
}
