import { currentUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { ExportButtons } from "@/components/export-buttons";
import { EntryLog } from "@/components/entries/entry-log";
import { loadEntries } from "@/lib/entries-page";
import { monthFromParams } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DeductionsPage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string; all?: string; page?: string }> }) {
  const sp = await searchParams;
  const user = await currentUser();
  const ym = sp.all ? "all" : monthFromParams(sp);
  const page = Math.max(1, Number(sp.page) || 1);
  const data = await loadEntries("deduction", ym, page);
  return (
    <div>
      <PageHeader
        title="سجل الخصومات والغرامات"
        hint="البند «تأخير»: اكتب دقائق التأخير وتُحسب تلقائيًا من راتب الموظف | «غرامة / سلفة / خصم آخر»: اكتب المبلغ مباشرة | خصم الغياب يُحسب تلقائيًا من سجل الحضور"
        actions={<ExportButtons table="deductions" params={{ ym }} />}
      />
      <EntryLog kind="deduction" ym={ym} page={page} canEdit={user?.role === "admin"} {...data} />
    </div>
  );
}
