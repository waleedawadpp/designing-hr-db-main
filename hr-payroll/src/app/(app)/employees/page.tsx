import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { ExportButtons } from "@/components/export-buttons";
import { EmployeesTable } from "@/components/employees/employees-table";
import { todayISO } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const user = await currentUser();
  const list = await prisma.employee.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return (
    <div>
      <PageHeader
        title="بيانات الموظفين"
        hint="أضف الموظف الجديد في أول سطر فارغ أسفل الجدول | لا تحذف موظفًا قديمًا — اكتب تاريخ انتهاء خدمته فقط"
        actions={<ExportButtons table="employees" />}
      />
      <EmployeesTable
        canEdit={user?.role === "admin"}
        today={todayISO()}
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
          notes: e.notes ?? "",
        }))}
      />
    </div>
  );
}
