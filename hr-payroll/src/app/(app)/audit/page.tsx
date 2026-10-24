import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";
const SIZE = 50;
const ACTIONS: Record<string, string> = { create: "إضافة", update: "تعديل", delete: "حذف" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [total, rows] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({ orderBy: { at: "desc" }, skip: (page - 1) * SIZE, take: SIZE }),
  ]);
  const pages = Math.max(1, Math.ceil(total / SIZE));
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Muscat", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return (
    <div>
      <PageHeader title="سجل التدقيق" hint="من غيّر ماذا ومتى — للقراءة فقط" />
      <div className="overflow-auto rounded-lg border border-line bg-white">
        <table className="tbl w-full">
          <thead><tr><th>الوقت</th><th>المستخدم</th><th>العملية</th><th>الجدول</th><th>الوصف</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td dir="ltr" className="text-right">{fmt.format(r.at)}</td>
                <td dir="ltr" className="text-right">{r.userEmail}</td>
                <td>{ACTIONS[r.action] ?? r.action}</td>
                <td>{r.entity}</td>
                <td className="whitespace-normal">{r.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="mt-2 flex gap-1 text-sm">
          {Array.from({ length: Math.min(pages, 30) }, (_, i) => i + 1).map((p) => (
            <Link key={p} href={`/audit?page=${p}`} className={`rounded px-2 ring-1 ring-line ${p === page ? "bg-navy text-white" : ""}`}>{p}</Link>
          ))}
        </div>
      )}
    </div>
  );
}
