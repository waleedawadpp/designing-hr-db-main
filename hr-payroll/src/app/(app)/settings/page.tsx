import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/report";
import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "@/components/settings/settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const me = await requireUser();
  if (me.role !== "admin") return <div className="rounded-lg border border-line bg-white p-4 text-sm">هذه الشاشة للمدير فقط.</div>;
  const s = await getSettings(prisma);
  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader title="الإعدادات" hint="تسري التعديلات على الأشهر غير المعتمدة فقط — الأشهر المعتمدة محفوظة كما اعتُمدت" />
      <SettingsForm settings={s} />
      <div className="rounded-lg border border-line bg-white p-4">
        <h2 className="mb-1 font-bold text-navy">نسخة احتياطية</h2>
        <p className="mb-3 text-sm text-slate-600">ملف Excel واحد فيه كل البيانات: الموظفون، الحضور، الإضافي، الخصومات، الأشهر المعتمدة، المستخدمون (بلا كلمات المرور)، الإعدادات وسجل التدقيق. احفظه في مكان آمن بانتظام.</p>
        <a href="/api/export?table=backup" className="inline-flex items-center gap-1 rounded bg-navy px-4 py-1.5 text-sm text-white" data-testid="backup-link">
          تنزيل نسخة احتياطية
        </a>
      </div>
    </div>
  );
}
