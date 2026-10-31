"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";

export interface SettingsState {
  ok?: boolean;
  error?: string;
}

export async function saveSettings(_: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await requireAdmin();
  const annualLeaveEntitlement = Number(form.get("annualLeaveEntitlement"));
  const weeklyOffDay = Number(form.get("weeklyOffDay"));
  const systemStartYear = Number(form.get("systemStartYear"));
  if (!Number.isInteger(annualLeaveEntitlement) || annualLeaveEntitlement < 0 || annualLeaveEntitlement > 365) return { error: "رصيد الإجازة بين 0 و 365 يومًا" };
  if (!Number.isInteger(weeklyOffDay) || weeklyOffDay < 0 || weeklyOffDay > 6) return { error: "يوم العطلة غير صحيح" };
  if (!Number.isInteger(systemStartYear) || systemStartYear < 2020 || systemStartYear > 2100) return { error: "سنة بداية النظام بين 2020 و 2100" };
  const before = await prisma.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  const data = { annualLeaveEntitlement, weeklyOffDay, systemStartYear };
  await prisma.settings.update({ where: { id: 1 }, data });
  await audit(user, "update", "Settings", "1", "تعديل الإعدادات", before, data);
  revalidatePath("/", "layout");
  return { ok: true };
}
