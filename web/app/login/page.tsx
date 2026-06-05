"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";

function LoginForm() {
  const { login } = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password, totp || undefined);
      router.push(next);
    } catch (e: any) {
      setError(e?.message || "فشل تسجيل الدخول");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-4">
      <h1 className="text-2xl font-bold">تسجيل الدخول</h1>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          required
          placeholder="البريد الإلكتروني"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-4 py-2"
        />
        <input
          type="password"
          required
          placeholder="كلمة المرور"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-4 py-2"
        />
        <input
          placeholder="رمز التحقق 2FA (إن وُجد)"
          value={totp}
          onChange={(e) => setTotp(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-4 py-2"
        />
        {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <button
          disabled={busy}
          className="w-full rounded-lg bg-brand py-2 font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          دخول
        </button>
      </form>
      <p className="text-sm text-slate-500">
        ليس لديك حساب؟{" "}
        <Link href="/register" className="font-semibold text-brand">
          أنشئ حساباً
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="py-10 text-center text-slate-400">…</p>}>
      <LoginForm />
    </Suspense>
  );
}
