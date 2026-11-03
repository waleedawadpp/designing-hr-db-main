import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { getSettings } from "@/lib/report";
import { ARABIC_WEEKDAYS, formatDate, isValidDate, weekdayOf } from "@/lib/payroll";
import { closedMonths } from "@/lib/month-close";
import { inService } from "@/lib/attendance";
import { todayISO } from "@/lib/utils";
import { DailyEntry } from "@/components/daily/daily-entry";

export const dynamic = "force-dynamic";

export default async function DailyAttendancePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const date = sp.date && isValidDate(sp.date) ? sp.date : todayISO();
  const month = date.slice(0, 7);
  const day = Number(date.slice(8, 10));
  const user = await currentUser();
  const settings = await getSettings(prisma);
  const employees = (await prisma.employee.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] })).filter((e) => inService(e, date));
  const rows = await prisma.attendanceMonth.findMany({
    where: { month, deletedAt: null, employeeId: { in: employees.map((e) => e.id) } },
    orderBy: { dupSeq: "asc" },
    include: { days: { where: { day } } },
  });
  const codeOf = new Map<string, string | null>();
  for (const r of rows) if (!codeOf.has(r.employeeId)) codeOf.set(r.employeeId, r.days[0]?.code ?? null);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-3 overflow-hidden rounded-lg border border-line shadow-sm">
        <div className="border-b-2 border-gold bg-navy px-4 py-3 text-white">
          <h1 className="text-base font-bold">التسجيل اليومي — {ARABIC_WEEKDAYS[weekdayOf(date)]} {formatDate(date)}</h1>
        </div>
        <div className="bg-cream px-4 py-2 text-sm text-slate-700">
          اختر اليوم، سجّل الغائبين والمجازين فقط، ثم اضغط «الباقي حاضر» • يعمل لأي يوم سابق • الحفظ تلقائي
        </div>
      </div>
      <DailyEntry
        date={date}
        isOffDay={weekdayOf(date) === settings.weeklyOffDay}
        closed={(await closedMonths(prisma)).includes(month)}
        canEdit={user?.role === "admin"}
        rows={employees.map((e) => ({ id: e.id, code: e.code, name: e.name, type: e.type, value: codeOf.get(e.id) ?? null }))}
      />
    </div>
  );
}
