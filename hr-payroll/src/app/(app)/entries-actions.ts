"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { assertMonthsOpen } from "@/lib/month-close";
import { DEDUCTION_ITEMS, EXTRA_ITEMS, isValidDate, isValidHM } from "@/lib/payroll";

export type EntryKind = "extra" | "deduction";

export interface EntryPatch {
  date?: string | null;
  employeeId?: string | null;
  item?: string | null;
  actualTime?: string;
  bonusAmount?: string;
  lateMinutes?: string;
  amount?: string;
  notes?: string;
}

type Result = { ok: true; id: string } | { ok: false; error: string };

function num(v: string, label: string): number | null {
  const s = v.trim();
  if (!s) return null;
  const n = Number(s.replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) throw new Error(`${label}: رقم غير صحيح`);
  return n;
}

export async function saveEntry(kind: EntryKind, id: string | null, patch: EntryPatch): Promise<Result> {
  const user = await requireAdmin();
  try {
    const data: Record<string, unknown> = {};
    if (patch.date !== undefined) {
      if (patch.date && !isValidDate(patch.date)) return { ok: false, error: "تاريخ غير صحيح — لا يُقبل ما قبل 01/01/2020" };
      data.date = patch.date || null;
    }
    if (patch.employeeId !== undefined) {
      if (patch.employeeId) {
        const e = await prisma.employee.findUnique({ where: { id: patch.employeeId } });
        if (!e) return { ok: false, error: "الاسم غير موجود في بيانات الموظفين" };
      }
      data.employeeId = patch.employeeId || null;
      data.rawName = null;
    }
    if (patch.item !== undefined) {
      const allowed: readonly string[] = kind === "extra" ? EXTRA_ITEMS : DEDUCTION_ITEMS;
      if (patch.item && !allowed.includes(patch.item)) return { ok: false, error: "بند غير صحيح" };
      data.item = patch.item || null;
    }
    if (patch.notes !== undefined) data.notes = patch.notes.trim() || null;
    if (kind === "extra") {
      if (patch.actualTime !== undefined) {
        const t = num(patch.actualTime, "الوقت الفعلي");
        if (t != null && !isValidHM(t)) return { ok: false, error: "الوقت بصيغة ساعات.دقائق والدقائق من 00 إلى 59 (مثال 1.30)" };
        data.actualTime = t;
      }
      if (patch.bonusAmount !== undefined) data.bonusAmount = num(patch.bonusAmount, "مبلغ المكافأة");
    } else {
      if (patch.lateMinutes !== undefined) data.lateMinutes = num(patch.lateMinutes, "دقائق التأخير");
      if (patch.amount !== undefined) data.amount = num(patch.amount, "المبلغ");
    }

    const model = (kind === "extra" ? prisma.extraEntry : prisma.deductionEntry) as unknown as {
      findUnique: (a: unknown) => Promise<Record<string, unknown> | null>;
      update: (a: unknown) => Promise<{ id: string }>;
      create: (a: unknown) => Promise<{ id: string }>;
    };
    const entity = kind === "extra" ? "ExtraEntry" : "DeductionEntry";
    const label = kind === "extra" ? "سجل الإضافي" : "سجل الخصم";
    if (id) {
      const before = await model.findUnique({ where: { id } });
      if (!before || before.deletedAt) return { ok: false, error: "السطر غير موجود" };
      // لا تعديل في شهر معتمد، ولا نقل سطر إليه
      await assertMonthsOpen(prisma, before.date as string | null, data.date as string | null | undefined);
      await model.update({ where: { id }, data });
      await audit(user, "update", entity, id, `تعديل سطر في ${label}: ${Object.keys(data).join("، ")}`, before, data);
      revalidatePath("/", "layout");
      return { ok: true, id };
    }
    await assertMonthsOpen(prisma, data.date as string | null | undefined);
    const created = await model.create({ data });
    await audit(user, "create", entity, created.id, `سطر جديد في ${label}`, undefined, data);
    revalidatePath("/", "layout");
    return { ok: true, id: created.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "تعذّر الحفظ" };
  }
}

/** حذف منطقي فقط (soft delete) — يبقى السجل في قاعدة البيانات. */
export async function softDeleteEntry(kind: EntryKind, id: string): Promise<Result> {
  const user = await requireAdmin();
  const entity = kind === "extra" ? "ExtraEntry" : "DeductionEntry";
  const row =
    kind === "extra"
      ? await prisma.extraEntry.findUnique({ where: { id }, select: { date: true } })
      : await prisma.deductionEntry.findUnique({ where: { id }, select: { date: true } });
  if (!row) return { ok: false, error: "السطر غير موجود" };
  try {
    await assertMonthsOpen(prisma, row.date);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "تعذّر الحذف" };
  }
  if (kind === "extra") await prisma.extraEntry.update({ where: { id }, data: { deletedAt: new Date() } });
  else await prisma.deductionEntry.update({ where: { id }, data: { deletedAt: new Date() } });
  await audit(user, "delete", entity, id, "حذف منطقي لسطر");
  revalidatePath("/", "layout");
  return { ok: true, id };
}
