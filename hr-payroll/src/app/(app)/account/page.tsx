import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { ChangePasswordForm } from "@/components/users/change-password-form";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const me = await requireUser();
  return (
    <div className="max-w-lg">
      <PageHeader title="تغيير كلمة المرور" hint={`${me.name} — ${me.email}`} />
      <ChangePasswordForm />
    </div>
  );
}
