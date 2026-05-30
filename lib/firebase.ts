// ============================================================
// lib/firebase.ts
// تهيئة Firebase بشكل آمن: إن لم تُضبط الإعدادات في config.ts
// تبقى القيمة null ويعمل التطبيق بالتخزين المحلي بدون أي خطأ.
// ============================================================

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { FIREBASE_CONFIG, FIREBASE_ENABLED } from "../config";

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

if (FIREBASE_ENABLED) {
  try {
    app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
    db = getFirestore(app);
  } catch (e) {
    // في حال أي خطأ بالتهيئة نكمل بالوضع المحلي
    console.warn("Firebase init failed, falling back to local mode:", e);
    app = null;
    db = null;
  }
}

/** قاعدة بيانات Firestore أو null إن لم يُفعّل Firebase */
export const firestore = db;

/** هل Firestore متاح فعلاً الآن؟ */
export const isCloudEnabled = (): boolean => firestore !== null;
