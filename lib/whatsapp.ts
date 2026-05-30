import { Linking, Platform } from "react-native";
import { STORE_NAME, WHATSAPP_NUMBER, CURRENCY } from "../config";
import { CartItem } from "../context/CartContext";

/** بيانات الزبون التي تُدخَل في شاشة إتمام الطلب */
export type CustomerInfo = {
  name: string;
  phone?: string;
  address: string;
  notes?: string;
};

function money(value: number): string {
  const v = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return `${v} ${CURRENCY}`;
}

/**
 * يبني نص رسالة الطلب الذي سيظهر في واتساب.
 * يتضمّن: اسم المتجر، كل منتج (الاسم × الكمية = السعر الفرعي)،
 * ثم المجموع الكلي، ثم بيانات الزبون (الاسم/الهاتف/العنوان/ملاحظات).
 * إذا لم تُمرَّر بيانات الزبون نترك الحقول فارغة ليملأها بنفسه.
 */
export function buildOrderMessage(
  items: CartItem[],
  total: number,
  customer?: CustomerInfo
): string {
  const lines: string[] = [];
  lines.push(`🛒 طلب جديد من ${STORE_NAME}`);
  lines.push("");
  lines.push("الطلب:");

  items.forEach((item, index) => {
    const subtotal = item.product.price * item.quantity;
    const priceText =
      item.product.price > 0 ? money(subtotal) : "السعر عند الطلب";
    lines.push(
      `${index + 1}) ${item.product.name} × ${item.quantity} = ${priceText}`
    );
  });

  lines.push("");
  lines.push(`المجموع الكلي: ${money(total)}`);
  lines.push("");
  lines.push("بيانات الزبون:");
  lines.push(`الاسم: ${customer?.name ?? ""}`);
  lines.push(`الهاتف: ${customer?.phone ?? ""}`);
  lines.push(`العنوان: ${customer?.address ?? ""}`);
  if (customer?.notes) {
    lines.push(`ملاحظات: ${customer.notes}`);
  }

  return lines.join("\n");
}

/** يبني رابط wa.me كاملاً مع النص المُرمَّز */
export function buildWhatsAppUrl(
  items: CartItem[],
  total: number,
  customer?: CustomerInfo
): string {
  const message = buildOrderMessage(items, total, customer);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/**
 * يفتح واتساب مع رسالة الطلب.
 * يعمل على الويب والجوال عبر Linking.openURL.
 */
export async function sendOrderToWhatsApp(
  items: CartItem[],
  total: number,
  customer?: CustomerInfo
): Promise<void> {
  const url = buildWhatsAppUrl(items, total, customer);

  if (Platform.OS === "web") {
    // فتح في تبويب جديد على الويب
    window.open(url, "_blank");
    return;
  }

  await Linking.openURL(url);
}
