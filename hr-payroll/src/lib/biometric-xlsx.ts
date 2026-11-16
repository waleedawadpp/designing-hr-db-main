// قراءة أول ورقة من ملف Excel (xlsx — برامج البصمة تحفظه أحيانًا بامتداد .xls) إلى صفوف خلايا.
import ExcelJS from "exceljs";

export class NotXlsxError extends Error {}

export async function readSheetRows(data: Uint8Array): Promise<unknown[][]> {
  // ملف xlsx هو أرشيف zip يبدأ بـ PK
  if (data.length < 4 || data[0] !== 0x50 || data[1] !== 0x4b) {
    throw new NotXlsxError("صيغة الملف غير مدعومة — احفظ التقرير من برنامج البصمة بصيغة Excel (.xlsx) ثم ارفعه");
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const rows: unknown[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cells[col - 1] = cell.value instanceof Date ? cell.value : cell.text;
    });
    rows.push(cells);
  });
  return rows;
}
