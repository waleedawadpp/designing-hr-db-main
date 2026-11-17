import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { UsersManager } from "@/components/users/users-manager";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requireUser();
  if (me.role !== "admin") {
    return <div className="rounded-lg border border-line bg-white p-4 text-sm">هذه الشاشة للمدير فقط.</div>;
  }
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  return (
    <div className="max-w-5xl">
      <PageHeader title="المستخدمون" hint="المدير يقرأ ويعدّل، والمشاهد يقرأ فقط • لا يُحذف مستخدم — عطّله لإيقاف دخوله فورًا" />
      <UsersManager
        meId={me.id}
        users={users.map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, disabled: !!u.disabledAt, createdAt: u.createdAt.toISOString().slice(0, 10) }))}
      />
    </div>
  );
}
