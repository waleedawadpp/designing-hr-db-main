import { CURRENCY } from "../config";

/**
 * تنسيق السعر للعرض.
 * إذا كان السعر = 0 (لم يُحدَّد بعد) نعرض "السعر عند الطلب".
 */
export function formatPrice(price: number): string {
  if (!price || price <= 0) return "السعر عند الطلب";
  // إزالة الأصفار العشرية غير الضرورية مع الحفاظ على رقمين كحد أقصى
  const value = Number.isInteger(price) ? String(price) : price.toFixed(2);
  return `${value} ${CURRENCY}`;
}

/** تنسيق مبلغ المجموع (يظهر دائماً مع العملة) */
export function formatTotal(total: number): string {
  const value = Number.isInteger(total) ? String(total) : total.toFixed(2);
  return `${value} ${CURRENCY}`;
}
