import { currentUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { BiometricImport } from "@/components/biometric/biometric-import";

export const dynamic = "force-dynamic";

export default async function BiometricPage() {
  const user = await currentUser();
  return (
    <div>
      <PageHeader
        title="استيراد البصمة"
        hint="ارفع «سجل الحركات» من جهاز البصمة: أي بصمة في اليوم = ح، ويوم العمل بلا بصمة = غ، والعطلة الأسبوعية والإجازات (إ، م) لا تُمس. راجع المعاينة وعدّل ثم اعتمد."
      />
      {user?.role !== "admin" ? (
        <div className="rounded-lg border border-line bg-white p-4 text-sm">هذه الشاشة للمدير فقط.</div>
      ) : (
        <BiometricImport />
      )}
    </div>
  );
}
