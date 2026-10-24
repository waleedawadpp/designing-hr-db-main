"use server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { importWorkbook } from "@/lib/xlsx-import";

export interface ImportState {
  ok?: boolean;
  lines?: string[];
  error?: string;
}

const MAX_BYTES = 20 * 1024 * 1024;

/** استيراد ملف الإكسل إلى قاعدة فارغة فقط (لا يمسح بيانات قائمة). */
export async function importExcel(_prev: ImportState, form: FormData): Promise<ImportState> {
  const user = await requireAdmin();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "اختر ملف Excel (.xlsx)" };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { error: "الملف يجب أن يكون بصيغة .xlsx" };
  if (file.size > MAX_BYTES) return { error: "حجم الملف أكبر من 20 ميغابايت" };
  try {
    const res = await importWorkbook(prisma, new Uint8Array(await file.arrayBuffer()), {
      fileName: file.name,
      requireEmpty: true,
      userEmail: user.email,
    });
    // بلا revalidatePath: تحديث الصفحة الآن يستبدل النتيجة برسالة «مقفل» (والصفحات كلها ديناميكية أصلًا)
    return { ok: res.ok, lines: res.lines };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "تعذّر الاستيراد" };
  }
}
