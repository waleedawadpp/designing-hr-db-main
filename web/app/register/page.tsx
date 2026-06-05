"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

export default function RegisterPage() {
  const { register } = useStore();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(fullName, email, password);
      router.push("/");
    } catch (e: any) {
      setError(e?.message || "تعذّر إنشاء الحساب");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-4">
      <h1 className="text-2xl font-bold">إنشاء حساب</h1>
      <form onSubmit={submit} className="space-y-3">
        <input
          required
          placeholder="الاسم الكامل"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-4 py-2"
        />
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
          minLength={8}
          placeholder="كلمة المرور (8 أحرف على الأقل)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-4 py-2"
        />
        {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <button
          disabled={busy}
          className="w-full rounded-lg bg-brand py-2 font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          إنشاء الحساب
        </button>
      </form>
      <p className="text-sm text-slate-500">
        لديك حساب؟{" "}
        <Link href="/login" className="font-semibold text-brand">
          سجّل الدخول
        </Link>
      </p>
    </div>
  );
}
