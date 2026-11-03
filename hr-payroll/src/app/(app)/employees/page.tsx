import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { ExportButtons } from "@/components/export-buttons";
import { EmployeesTable } from "@/components/employees/employees-table";
import { todayISO } from "@/lib/utils";
import { getSettings } from "@/lib/report";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const user = await currentUser();
  const settings = await getSettings(prisma);
  const list = await prisma.employee.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return (
    <div>
      <PageHeader
        title="بيانات الموظفين"
        hint="«إضافة موظف» لموظف جديد، و✎ لتعديل موظف (أو عدّل في الجدول مباشرة) | لا تحذف موظفًا قديمًا — اكتب تاريخ انتهاء خدمته فقط"
        actions={<ExportButtons table="employees" />}
      />
      <EmployeesTable
        canEdit={user?.role === "admin"}
        today={todayISO()}
        defaultLeave={settings.annualLeaveEntitlement}
        rows={list.map((e) => ({
          id: e.id,
          code: e.code,
          name: e.name,
          type: e.type,
          monthlySalary: e.monthlySalary?.toString() ?? "",
          dailyWage: e.dailyWage?.toString() ?? "",
          dailyHours: e.dailyHours?.toString() ?? "9",
          hireDate: e.hireDate,
          endDate: e.endDate,
          leavesBeforeSystem: e.leavesBeforeSystem?.toString() ?? "",
          annualLeave: e.annualLeave?.toString() ?? "",
          leaveOpeningBalance: e.leaveOpeningBalance?.toString() ?? "",
          notes: e.notes ?? "",
        }))}
      />
    </div>
  );
}
