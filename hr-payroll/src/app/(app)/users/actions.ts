"use server";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { currentUser, requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";

export interface FormState {
  ok?: boolean;
  message?: string;
  error?: string;
}

const MIN_PASSWORD = 8;
const ROLES = ["admin", "viewer"];
const ROLE_LABEL: Record<string, string> = { admin: "مدير", viewer: "مشاهد" };

function passwordError(p: string): string | null {
  if (p.length < MIN_PASSWORD) return `كلمة المرور ${MIN_PASSWORD} أحرف على الأقل`;
  if (!/[A-Za-z؀-ۿ]/.test(p) || !/\d/.test(p)) return "كلمة المرور يجب أن تحتوي حروفًا وأرقامًا";
  return null;
}

/** عدد المديرين الفعّالين غير المستخدم المحدد — لمنع إقفال النظام بلا مدير. */
async function otherActiveAdmins(id: string) {
  return prisma.user.count({ where: { role: "admin", disabledAt: null, id: { not: id } } });
}

export async function createUser(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const name = String(form.get("name") ?? "").trim();
  const role = String(form.get("role") ?? "viewer");
  const password = String(form.get("password") ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "بريد إلكتروني غير صحيح" };
  if (!name) return { error: "الاسم مطلوب" };
  if (!ROLES.includes(role)) return { error: "صلاحية غير صحيحة" };
  const pe = passwordError(password);
  if (pe) return { error: pe };
  if (await prisma.user.findUnique({ where: { email } })) return { error: "هذا البريد مستخدم بالفعل" };
  const u = await prisma.user.create({ data: { email, name, role, passwordHash: await bcrypt.hash(password, 10) } });
  await audit(admin, "create", "User", u.id, `إضافة مستخدم ${email} (${ROLE_LABEL[role]})`);
  revalidatePath("/users");
  return { ok: true, message: `✔ أُضيف ${name}` };
}

export async function setUserRole(id: string, role: string): Promise<FormState> {
  const admin = await requireAdmin();
  if (!ROLES.includes(role)) return { error: "صلاحية غير صحيحة" };
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) return { error: "المستخدم غير موجود" };
  if (u.role === "admin" && role !== "admin" && (await otherActiveAdmins(id)) === 0) return { error: "لا يمكن إزالة صلاحية آخر مدير" };
  await prisma.user.update({ where: { id }, data: { role } });
  await audit(admin, "update", "User", id, `صلاحية ${u.email}: ${ROLE_LABEL[u.role]} ← ${ROLE_LABEL[role]}`);
  revalidatePath("/users");
  return { ok: true };
}

export async function setUserDisabled(id: string, disabled: boolean): Promise<FormState> {
  const admin = await requireAdmin();
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) return { error: "المستخدم غير موجود" };
  if (id === admin.id && disabled) return { error: "لا يمكنك تعطيل حسابك" };
  if (disabled && u.role === "admin" && (await otherActiveAdmins(id)) === 0) return { error: "لا يمكن تعطيل آخر مدير" };
  await prisma.user.update({ where: { id }, data: { disabledAt: disabled ? new Date() : null } });
  await audit(admin, "update", "User", id, `${disabled ? "تعطيل" : "تفعيل"} ${u.email}`);
  revalidatePath("/users");
  return { ok: true };
}

export async function resetUserPassword(id: string, password: string): Promise<FormState> {
  const admin = await requireAdmin();
  const pe = passwordError(password);
  if (pe) return { error: pe };
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) return { error: "المستخدم غير موجود" };
  await prisma.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  await audit(admin, "update", "User", id, `تعيين كلمة مرور جديدة لـ ${u.email}`);
  return { ok: true, message: `✔ تغيّرت كلمة مرور ${u.name}` };
}

/** تغيير كلمة المرور للمستخدم الحالي (مدير أو مشاهد). */
export async function changeOwnPassword(_: FormState, form: FormData): Promise<FormState> {
  const me = await currentUser();
  if (!me) return { error: "يجب تسجيل الدخول" };
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  const u = await prisma.user.findUnique({ where: { id: me.id } });
  if (!u || !(await bcrypt.compare(current, u.passwordHash))) return { error: "كلمة المرور الحالية غير صحيحة" };
  if (next !== confirm) return { error: "كلمتا المرور الجديدتان غير متطابقتين" };
  if (next === current) return { error: "اختر كلمة مرور مختلفة عن الحالية" };
  const pe = passwordError(next);
  if (pe) return { error: pe };
  await prisma.user.update({ where: { id: me.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
  await audit(me, "update", "User", me.id, "تغيير كلمة المرور");
  return { ok: true, message: "✔ تغيّرت كلمة المرور" };
}
