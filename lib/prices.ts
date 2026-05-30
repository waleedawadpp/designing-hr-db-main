// ============================================================
// lib/prices.ts
// طبقة الأسعار: تخزّن الأسعار المعدّلة من الأدمن وتقرأها.
// ـ إن فُعّل Firebase: تُحفظ في Firestore وتتزامن لحظياً لكل الزبائن.
// ـ إن لم يُفعّل: تُحفظ محلياً (AsyncStorage) على الجهاز فقط.
// المفتاح في كلتا الحالتين هو معرّف المنتج (id) → السعر (number).
// ============================================================

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  doc,
  onSnapshot,
  setDoc,
  getDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { firestore, isCloudEnabled } from "./firebase";

/** خريطة: معرّف المنتج → السعر */
export type PriceMap = Record<number, number>;

const LOCAL_KEY = "@drinks_store_prices";
// مسار مستند الأسعار في Firestore (مجموعة واحدة، مستند واحد يحوي كل الأسعار)
const CLOUD_COLLECTION = "store";
const CLOUD_DOC = "prices";

// ---------------------- تخزين محلي ----------------------

async function readLocal(): Promise<PriceMap> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as PriceMap) : {};
  } catch {
    return {};
  }
}

async function writeLocal(prices: PriceMap): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(prices));
  } catch {
    // تجاهُل أخطاء الكتابة المحلية
  }
}

// ---------------------- واجهة موحّدة ----------------------

/** قراءة الأسعار مرة واحدة (سحابياً إن أمكن وإلا محلياً) */
export async function loadPrices(): Promise<PriceMap> {
  if (isCloudEnabled() && firestore) {
    try {
      const snap = await getDoc(doc(firestore, CLOUD_COLLECTION, CLOUD_DOC));
      const data = (snap.data()?.items ?? {}) as PriceMap;
      // نحفظ نسخة محلية للعمل دون اتصال
      await writeLocal(data);
      return normalize(data);
    } catch {
      // عند فشل الشبكة نرجع للنسخة المحلية
      return readLocal();
    }
  }
  return readLocal();
}

/**
 * الاشتراك في تحديثات الأسعار اللحظية.
 * يستدعي callback فوراً بالقيمة الحالية ثم عند كل تغيير.
 * يُرجع دالة لإلغاء الاشتراك.
 */
export function subscribePrices(cb: (prices: PriceMap) => void): Unsubscribe {
  if (isCloudEnabled() && firestore) {
    return onSnapshot(
      doc(firestore, CLOUD_COLLECTION, CLOUD_DOC),
      (snap) => {
        const data = (snap.data()?.items ?? {}) as PriceMap;
        writeLocal(data);
        cb(normalize(data));
      },
      () => {
        // عند خطأ الاشتراك نقرأ المحلي مرة واحدة
        readLocal().then(cb);
      }
    );
  }
  // وضع محلي: نقرأ مرة واحدة ونعيد دالة إلغاء فارغة
  readLocal().then(cb);
  return () => {};
}

/** حفظ كامل خريطة الأسعار (يستخدمها الأدمن) */
export async function savePrices(prices: PriceMap): Promise<void> {
  const clean = normalize(prices);
  await writeLocal(clean);
  if (isCloudEnabled() && firestore) {
    await setDoc(doc(firestore, CLOUD_COLLECTION, CLOUD_DOC), { items: clean });
  }
}

/** تحديث سعر منتج واحد ودمجه مع الباقي */
export async function setPrice(
  current: PriceMap,
  productId: number,
  price: number
): Promise<PriceMap> {
  const next = { ...current, [productId]: price };
  await savePrices(next);
  return next;
}

// ---------------------- أدوات ----------------------

/** يضمن أن المفاتيح أرقام والقيم أرقام صحيحة غير سالبة */
function normalize(prices: PriceMap): PriceMap {
  const out: PriceMap = {};
  for (const [k, v] of Object.entries(prices ?? {})) {
    const id = Number(k);
    const price = Number(v);
    if (!Number.isNaN(id) && !Number.isNaN(price) && price >= 0) {
      out[id] = price;
    }
  }
  return out;
}
