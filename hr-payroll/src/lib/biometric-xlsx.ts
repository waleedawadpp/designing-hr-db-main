// قراءة أول ورقة من ملف Excel (xlsx — برامج البصمة تحفظه أحيانًا بامتداد .xls) إلى صفوف خلايا.
// نستخدم قارئ JSZip نفسه في شاشة «استيراد من Excel» بدل exceljs: خادم Hostinger (standalone)
// لا ينسخ كل ملفات exceljs فيفشل تحميلها هناك.
import { loadBook } from "./xlsx-import";

export class NotXlsxError extends Error {}

/** رقم تسلسلي في Excel (أيام منذ 1899-12-30) ← تاريخ UTC */
function excelSerialToDate(n: number) {
  return new Date(Math.round((n - 25569) * 86400000));
}

function colNum(letters: string) {
  return letters.split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
}

export async function readSheetRows(data: Uint8Array): Promise<unknown[][]> {
  // ملف xlsx هو أرشيف zip يبدأ بـ PK
  if (data.length < 4 || data[0] !== 0x50 || data[1] !== 0x4b) {
    throw new NotXlsxError("صيغة الملف غير مدعومة — احفظ التقرير من برنامج البصمة بصيغة Excel (.xlsx) ثم ارفعه");
  }
  const book = await loadBook(data);
  const sheet = book.sheets.values().next().value;
  if (!sheet) return [];
  const rows: unknown[][] = [];
  for (const [ref, v] of sheet.cells) {
    const m = /^([A-Z]+)(\d+)$/.exec(ref);
    if (!m) continue;
    const r = Number(m[2]) - 1;
    // خلية رقمية كبيرة = تاريخ/وقت محفوظ كرقم تسلسلي
    (rows[r] ??= [])[colNum(m[1]) - 1] = typeof v === "number" && v > 20000 && v < 80000 ? excelSerialToDate(v) : v == null ? "" : String(v);
  }
  return rows.filter(Boolean);
}
