"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarCheck,
  Clock,
  FileSpreadsheet,
  FileText,
  History,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  MinusCircle,
  Receipt,
  Settings,
  Upload,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: typeof Users; adminOnly?: boolean };

const GROUPS: { label: string; color: string; items: Item[] }[] = [
  {
    label: "شاشات العرض",
    color: "#13294B",
    items: [
      { href: "/", label: "لوحة التحكم", icon: LayoutDashboard },
      { href: "/monthly", label: "الكشف الشهري", icon: FileSpreadsheet },
      { href: "/payslip", label: "قسائم الرواتب", icon: Receipt },
    ],
  },
  {
    label: "شاشات الإدخال",
    color: "#C9A227",
    items: [
      { href: "/attendance", label: "إدخال الحضور", icon: CalendarCheck },
      { href: "/employees", label: "بيانات الموظفين", icon: Users },
      { href: "/extras", label: "سجل الإضافي", icon: Clock },
      { href: "/deductions", label: "سجل الخصم", icon: MinusCircle },
    ],
  },
  {
    label: "شاشات أخرى",
    color: "#94A3B8",
    items: [
      { href: "/leave-form", label: "نموذج الإجازة", icon: FileText },
      { href: "/audit", label: "سجل التدقيق", icon: History },
      { href: "/users", label: "المستخدمون", icon: UserCog, adminOnly: true },
      { href: "/settings", label: "الإعدادات", icon: Settings, adminOnly: true },
      { href: "/import", label: "استيراد من Excel", icon: Upload, adminOnly: true },
    ],
  },
];

export function Sidebar({ user }: { user: { name: string; role: string } }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isAdmin = user.role === "admin";

  // إغلاق القائمة عند الانتقال لصفحة أخرى (على الجوال)
  useEffect(() => setOpen(false), [path]);

  const nav = (
    <>
      <div className="border-b-4 border-gold bg-navy px-4 py-4 text-white">
        <div className="flex items-center justify-between">
          <div className="text-lg font-bold">الحضور والرواتب</div>
          <button className="lg:hidden" aria-label="إغلاق القائمة" onClick={() => setOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <div className="mt-1 text-xs text-slate-300">
          {user.name} • {isAdmin ? "مدير" : "مشاهد"}
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {GROUPS.map((g) => (
          <div key={g.label} className="mb-3">
            <div className="px-2 py-1 text-[11px] font-semibold text-slate-400">{g.label}</div>
            {g.items
              .filter((it) => isAdmin || !it.adminOnly)
              .map((it) => {
                const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
                const Icon = it.icon;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-page",
                      active && "bg-cream font-semibold text-navy ring-1 ring-gold",
                    )}
                  >
                    <Icon size={18} color={g.color} />
                    {it.label}
                  </Link>
                );
              })}
          </div>
        ))}
      </nav>
      <div className="border-t border-line p-2">
        <Link href="/account" className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-600 hover:bg-page">
          <KeyRound size={18} /> تغيير كلمة المرور
        </Link>
        <form action="/api/auth/logout" method="post">
          <button className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-600 hover:bg-page">
            <LogOut size={18} /> تسجيل الخروج
          </button>
        </form>
      </div>
    </>
  );

  return (
    <>
      {/* شريط علوي للجوال والشاشات الصغيرة */}
      <div className="no-print sticky top-0 z-40 flex items-center justify-between border-b-2 border-gold bg-navy px-4 py-2 text-white lg:hidden">
        <button aria-label="فتح القائمة" onClick={() => setOpen(true)} className="rounded p-1 hover:bg-white/10">
          <Menu size={22} />
        </button>
        <span className="font-bold">الحضور والرواتب</span>
        <span className="w-6" />
      </div>
      {open && <div className="no-print fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={cn(
          "no-print z-50 flex h-screen w-60 shrink-0 flex-col border-l border-line bg-white",
          "fixed inset-y-0 right-0 transition-transform lg:sticky lg:top-0 lg:translate-x-0",
          open ? "translate-x-0 shadow-xl" : "translate-x-full",
        )}
      >
        {nav}
      </aside>
    </>
  );
}
