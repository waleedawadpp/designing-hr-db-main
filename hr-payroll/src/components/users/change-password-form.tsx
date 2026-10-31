"use client";
import { useActionState } from "react";
import { changeOwnPassword, type FormState } from "@/app/(app)/users/actions";

const field = "mt-1 w-full rounded border border-line px-3 py-2 text-[#0000FF] focus:border-gold focus:outline-none";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changeOwnPassword, {});
  return (
    <form action={action} className="space-y-3 rounded-lg border border-line bg-white p-4">
      <label className="block text-sm">كلمة المرور الحالية
        <input name="current" type="password" required dir="ltr" autoComplete="current-password" className={field} />
      </label>
      <label className="block text-sm">كلمة المرور الجديدة <span className="text-xs text-slate-500">(8 أحرف على الأقل، حروف وأرقام)</span>
        <input name="next" type="password" required dir="ltr" autoComplete="new-password" className={field} />
      </label>
      <label className="block text-sm">تأكيد كلمة المرور الجديدة
        <input name="confirm" type="password" required dir="ltr" autoComplete="new-password" className={field} />
      </label>
      {state.error && <div role="alert" className="rounded bg-[#FEE2E2] px-3 py-2 text-sm font-semibold text-[#B91C1C]">{state.error}</div>}
      {state.ok && <div className="rounded bg-[#DCFCE7] px-3 py-2 text-sm font-semibold text-[#166534]">{state.message}</div>}
      <button disabled={pending} className="w-full rounded bg-navy py-2 font-semibold text-white disabled:opacity-50">حفظ</button>
    </form>
  );
}
