import { currentUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { ExportButtons } from "@/components/export-buttons";
import { EntryLog } from "@/components/entries/entry-log";
import { loadEntries } from "@/lib/entries-page";
import { monthFromParams } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ExtrasPage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string; all?: string; page?: string }> }) {
  const sp = await searchParams;
  const user = await currentUser();
  const ym = sp.all ? "all" : monthFromParams(sp);
  const page = Math.max(1, Number(sp.page) || 1);
  const data = await loadEntries("extra", ym, page);
  return (
    <div>
      <PageHeader
        title="سجل العمل الإضافي والمكافآت"
        hint="البند «ساعات إضافية»: اكتب الوقت الفعلي بصيغة ساعات.دقائق (1.30 = ساعة و30 دقيقة) وتُحسب الأجرة تلقائيًا من راتب الموظف | «مكافأة»: اكتب المبلغ في عمود مبلغ المكافأة"
        actions={<ExportButtons table="extras" params={{ ym }} />}
      />
      <EntryLog kind="extra" ym={ym} page={page} canEdit={user?.role === "admin"} {...data} />
    </div>
  );
}
