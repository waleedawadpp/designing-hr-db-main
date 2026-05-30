// ============================================================
// context/PricesContext.tsx
// يوفّر المنتجات مع دمج الأسعار الحيّة (من السحابة أو المحلي) فوق
// الكتالوج الثابت. هكذا تظهر تعديلات الأدمن فوراً في كل الشاشات.
// ============================================================

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { PRODUCTS, Product } from "../data/products";
import {
  loadPrices,
  savePrices,
  subscribePrices,
  type PriceMap,
} from "../lib/prices";
import { isCloudEnabled } from "../lib/firebase";

type PricesContextValue = {
  /** المنتجات بعد دمج الأسعار المحدّثة */
  products: Product[];
  /** خريطة الأسعار الخام (id → price) */
  prices: PriceMap;
  /** هل التزامن السحابي مفعّل؟ */
  cloud: boolean;
  /** جلب منتج واحد بمعرّفه (بسعره المحدّث) */
  getProduct: (id: number) => Product | undefined;
  /** حفظ كامل خريطة الأسعار (للأدمن) */
  updatePrices: (next: PriceMap) => Promise<void>;
  loading: boolean;
};

const PricesContext = createContext<PricesContextValue | undefined>(undefined);

export function PricesProvider({ children }: { children: React.ReactNode }) {
  const [prices, setPrices] = useState<PriceMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    // قراءة أولية سريعة
    loadPrices().then((p) => {
      if (mounted) {
        setPrices(p);
        setLoading(false);
      }
    });
    // اشتراك لحظي (سحابي) أو لا شيء (محلي)
    const unsub = subscribePrices((p) => {
      if (mounted) {
        setPrices(p);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  // دمج الأسعار فوق الكتالوج الثابت
  const products = useMemo(
    () =>
      PRODUCTS.map((p) =>
        prices[p.id] != null ? { ...p, price: prices[p.id] } : p
      ),
    [prices]
  );

  const getProduct = useCallback(
    (id: number) => products.find((p) => p.id === id),
    [products]
  );

  const updatePrices = useCallback(async (next: PriceMap) => {
    setPrices(next); // تحديث فوري للواجهة
    await savePrices(next);
  }, []);

  const value = useMemo(
    () => ({
      products,
      prices,
      cloud: isCloudEnabled(),
      getProduct,
      updatePrices,
      loading,
    }),
    [products, prices, getProduct, updatePrices, loading]
  );

  return (
    <PricesContext.Provider value={value}>{children}</PricesContext.Provider>
  );
}

export function usePrices(): PricesContextValue {
  const ctx = useContext(PricesContext);
  if (!ctx) throw new Error("usePrices must be used within a PricesProvider");
  return ctx;
}
