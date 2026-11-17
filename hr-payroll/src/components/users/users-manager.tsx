"use client";
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { createUser, resetUserPassword, setUserDisabled, setUserRole, type FormState } from "@/app/(app)/users/actions";
import { formatDate } from "@/lib/payroll";
import { cn } from "@/lib/utils";

interface Row {
  id: string;
  email: string;
  name: string;
  role: string;
  disabled: boolean;
  createdAt: string;
}

const field = "w-full rounded border border-line px-3 py-1.5 text-sm text-[#0000FF] focus:border-gold focus:outline-none";

export function UsersManager({ users, meId }: { users: Row[]; meId: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<FormState, FormData>(createUser, {});
  const [msg, setMsg] = useState<FormState>({});
  const [busy, start] = useTransition();

  function run(p: () => Promise<FormState>) {
    start(async () => {
      const r = await p();
      setMsg(r);
      router.refresh();
    });
  }

  function reset(u: Row) {
    const pw = prompt(`كلمة مرور جديدة لـ ${u.name} (8 أحرف على الأقل، حروف وأرقام):`);
    if (pw) run(() => resetUserPassword(u.id, pw));
  }

  return (
    <div className="space-y-4">
      <form action={action} className="grid gap-3 rounded-lg border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <input name="name" placeholder="الاسم" aria-label="الاسم" required className={field} />
        <input name="email" type="email" placeholder="البريد الإلكتروني" aria-label="البريد الإلكتروني" required dir="ltr" className={field} />
        <input name="password" type="password" placeholder="كلمة المرور" aria-label="كلمة المرور" required dir="ltr" className={field} autoComplete="new-password" />
        <select name="role" aria-label="الصلاحية" className={field} defaultValue="viewer">
          <option value="viewer">مشاهد (قراءة فقط)</option>
          <option value="admin">مدير</option>
        </select>
        <button disabled={pending} className="flex items-center justify-center gap-1 rounded bg-navy px-4 py-1.5 text-sm text-white disabled:opacity-50">
          <UserPlus size={16} color="#C9A227" /> إضافة مستخدم
        </button>
      </form>
      {(state.error || msg.error) && <div role="alert" className="rounded border border-[#B91C1C] bg-[#FEE2E2] px-3 py-2 text-sm font-semibold text-[#B91C1C]">{state.error || msg.error}</div>}
      {(state.message || msg.message) && !(state.error || msg.error) && <div className="rounded bg-[#DCFCE7] px-3 py-2 text-sm font-semibold text-[#166534]">{msg.message || state.message}</div>}

      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="tbl w-full" data-testid="users-table">
          <thead>
            <tr><th>الاسم</th><th>البريد</th><th>الصلاحية</th><th>الحالة</th><th>أُضيف في</th><th>إجراءات</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={cn(u.disabled && "opacity-60")}>
                <td className="font-medium">{u.name}{u.id === meId && <span className="ms-1 text-xs text-slate-500">(أنت)</span>}</td>
                <td dir="ltr" className="text-right">{u.email}</td>
                <td className="!py-0">
                  <select aria-label={`صلاحية ${u.name}`} className="inp py-1" value={u.role} disabled={busy} onChange={(e) => run(() => setUserRole(u.id, e.target.value))}>
                    <option value="admin">مدير</option>
                    <option value="viewer">مشاهد</option>
                  </select>
                </td>
                <td>{u.disabled ? <span className="text-[#B91C1C]">معطّل</span> : <span className="text-[#166534]">فعّال</span>}</td>
                <td dir="ltr" className="text-right">{formatDate(u.createdAt)}</td>
                <td className="space-x-2 space-x-reverse whitespace-nowrap">
                  <button disabled={busy} onClick={() => reset(u)} className="rounded border border-line px-2 py-0.5 text-xs hover:border-gold">كلمة مرور جديدة</button>
                  {u.id !== meId && (
                    <button disabled={busy} onClick={() => run(() => setUserDisabled(u.id, !u.disabled))} className="rounded border border-line px-2 py-0.5 text-xs hover:border-gold">
                      {u.disabled ? "تفعيل" : "تعطيل"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
