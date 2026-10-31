import { Sidebar } from "@/components/sidebar";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen lg:flex">
      <Sidebar user={user} />
      <main className="min-w-0 flex-1 p-3 sm:p-4">{children}</main>
    </div>
  );
}
