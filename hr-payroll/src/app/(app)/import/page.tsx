import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { ImportForm } from "@/components/import/import-form";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const user = await currentUser();
  const employees = await prisma.employee.count();
  return (
    <div className="max-w-4xl">
      <PageHeader
        title="استيراد من Excel"
        hint="ارفع ملف الإكسل الحالي (الجداول tblEmp و tblGrid و tblOT و tblDed) — يُستورد مرة واحدة إلى قاعدة فارغة، ثم يُقارن صافي كل موظف مع الإكسل (فرق مسموح 0.001)"
      />
      {user?.role !== "admin" ? (
        <div className="rounded-lg border border-line bg-white p-4 text-sm">هذه الشاشة للمدير فقط.</div>
      ) : employees > 0 ? (
        <div className="rounded-lg border border-line bg-white p-4 text-sm">
          قاعدة البيانات فيها {employees} موظفًا بالفعل، لذلك الاستيراد من الشاشة مقفل حتى لا تتكرر البيانات أو تُمسح.
        </div>
      ) : (
        <ImportForm />
      )}
    </div>
  );
}
