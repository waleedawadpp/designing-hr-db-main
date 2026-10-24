"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, Clock, FileSpreadsheet, FileText, History, LayoutDashboard, LogOut, MinusCircle, Upload, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const GROUPS = [
  {
    label: "شاشات العرض",
    color: "#13294B",
    items: [
      { href: "/", label: "لوحة التحكم", icon: LayoutDashboard },
      { href: "/monthly", label: "الكشف الشهري", icon: FileSpreadsheet },
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
      { href: "/import", label: "استيراد من Excel", icon: Upload },
    ],
  },
];

export function Sidebar({ user }: { user: { name: string; role: string } }) {
  const path = usePathname();
  return (
    <aside className="no-print sticky top-0 flex h-screen w-56 shrink-0 flex-col border-l border-line bg-white">
      <div className="border-b-4 border-gold bg-navy px-4 py-4 text-white">
        <div className="text-lg font-bold">الحضور والرواتب</div>
        <div className="mt-1 text-xs text-slate-300">
          {user.name} • {user.role === "admin" ? "مدير" : "مشاهد"}
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {GROUPS.map((g) => (
          <div key={g.label} className="mb-3">
            <div className="px-2 py-1 text-[11px] font-semibold text-slate-400">{g.label}</div>
            {g.items.map((it) => {
              const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
              const Icon = it.icon;
              return (
                <Link
                  key={it.href}
                  href={it.href}
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
      <form action="/api/auth/logout" method="post" className="border-t border-line p-2">
        <button className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-600 hover:bg-page">
          <LogOut size={18} /> تسجيل الخروج
        </button>
      </form>
    </aside>
  );
}
