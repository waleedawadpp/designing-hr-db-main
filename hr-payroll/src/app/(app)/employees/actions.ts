"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { EMP_TYPES, isValidDate } from "@/lib/payroll";

export interface EmployeeInput {
  code: string;
  name: string;
  type: string;
  monthlySalary: string;
  dailyWage: string;
  dailyHours: string;
  hireDate: string | null;
  endDate: string | null;
  leavesBeforeSystem: string;
  notes: string;
}

export type SaveResult = { ok: true; id: string } | { ok: false; errors: Partial<Record<keyof EmployeeInput, string>> };

function num(v: string): number | null | "bad" {
  const s = v.trim();
  if (!s) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : "bad";
}

export async function saveEmployee(id: string | null, input: EmployeeInput): Promise<SaveResult> {
  const user = await requireAdmin();
  const errors: Partial<Record<keyof EmployeeInput, string>> = {};
  const code = input.code.trim();
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!code) errors.code = "الرقم مطلوب";
  if (!name) errors.name = "الاسم مطلوب";
  if (!(EMP_TYPES as readonly string[]).includes(input.type)) errors.type = "اختر النوع";
  const salary = num(input.monthlySalary);
  const wage = num(input.dailyWage);
  const hours = num(input.dailyHours);
  const before = num(input.leavesBeforeSystem);
  if (salary === "bad") errors.monthlySalary = "رقم غير صحيح";
  if (wage === "bad") errors.dailyWage = "رقم غير صحيح";
  if (hours === "bad" || hours === 0) errors.dailyHours = "رقم أكبر من صفر";
  if (before === "bad") errors.leavesBeforeSystem = "رقم غير صحيح";
  if (input.type === "موظف" && salary === null) errors.monthlySalary = "الراتب مطلوب للموظف";
  if (input.type === "سائق يومي" && wage === null) errors.dailyWage = "الأجرة اليومية مطلوبة للسائق";
  if (input.hireDate && !isValidDate(input.hireDate)) errors.hireDate = "تاريخ غير صحيح (من 01/01/2020)";
  if (input.endDate && !isValidDate(input.endDate)) errors.endDate = "تاريخ غير صحيح (من 01/01/2020)";
  if (input.hireDate && input.endDate && input.endDate < input.hireDate) errors.endDate = "قبل تاريخ التعيين";

  if (code) {
    const dup = await prisma.employee.findUnique({ where: { code } });
    if (dup && dup.id !== id) errors.code = "الرقم مستخدم لموظف آخر";
  }
  if (name) {
    const dup = await prisma.employee.findUnique({ where: { name } });
    if (dup && dup.id !== id) errors.name = "الاسم مستخدم لموظف آخر";
  }
  if (Object.keys(errors).length) return { ok: false, errors };

  const data = {
    code,
    name,
    type: input.type,
    monthlySalary: salary as number | null,
    dailyWage: wage as number | null,
    dailyHours: (hours as number | null) ?? 9,
    hireDate: input.hireDate || null,
    endDate: input.endDate || null,
    leavesBeforeSystem: before as number | null,
    notes: input.notes.trim() || null,
  };

  if (id) {
    const prev = await prisma.employee.findUnique({ where: { id } });
    if (!prev) return { ok: false, errors: { name: "الموظف غير موجود" } };
    await prisma.employee.update({ where: { id }, data });
    const changed = (Object.keys(data) as (keyof typeof data)[]).filter((k) => prev[k] !== data[k]);
    if (changed.length) await audit(user, "update", "Employee", id, `تعديل ${name}: ${changed.join("، ")}`, prev, data);
    revalidatePath("/", "layout");
    return { ok: true, id };
  }
  const max = await prisma.employee.aggregate({ _max: { sortOrder: true } });
  const created = await prisma.employee.create({ data: { ...data, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
  await audit(user, "create", "Employee", created.id, `إضافة موظف ${name}`, undefined, data);
  revalidatePath("/", "layout");
  return { ok: true, id: created.id };
}
