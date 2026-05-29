import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Product, PRODUCTS } from "../data/products";

export type CartItem = {
  product: Product;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  /** إجمالي عدد القطع في السلة (لشارة العدّاد) */
  count: number;
  /** المجموع الكلي للأسعار */
  total: number;
  addItem: (product: Product) => void;
  removeItem: (productId: number) => void;
  increment: (productId: number) => void;
  decrement: (productId: number) => void;
  clear: () => void;
  getQuantity: (productId: number) => number;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

// مفتاح التخزين المحلي (AsyncStorage على الجوال، localStorage على الويب)
const STORAGE_KEY = "@drinks_store_cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  // نمنع الكتابة فوق البيانات المخزّنة قبل اكتمال تحميلها
  const hydrated = useRef(false);

  // تحميل السلة المحفوظة عند بدء التطبيق
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved: { id: number; quantity: number }[] = JSON.parse(raw);
          const restored: CartItem[] = [];
          for (const entry of saved) {
            const product = PRODUCTS.find((p) => p.id === entry.id);
            if (product && entry.quantity > 0) {
              restored.push({ product, quantity: entry.quantity });
            }
          }
          if (restored.length > 0) setItems(restored);
        }
      } catch {
        // تجاهُل أي خطأ في القراءة والبدء بسلة فارغة
      } finally {
        hydrated.current = true;
      }
    })();
  }, []);

  // حفظ السلة عند كل تغيير (نخزّن المعرّف والكمية فقط)
  useEffect(() => {
    if (!hydrated.current) return;
    const payload = items.map((i) => ({
      id: i.product.id,
      quantity: i.quantity,
    }));
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => {});
  }, [items]);

  const addItem = useCallback((product: Product) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const increment = useCallback((productId: number) => {
    setItems((prev) =>
      prev.map((i) =>
        i.product.id === productId ? { ...i, quantity: i.quantity + 1 } : i
      )
    );
  }, []);

  const decrement = useCallback((productId: number) => {
    setItems((prev) =>
      prev
        .map((i) =>
          i.product.id === productId
            ? { ...i, quantity: i.quantity - 1 }
            : i
        )
        .filter((i) => i.quantity > 0)
    );
  }, []);

  const removeItem = useCallback((productId: number) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const getQuantity = useCallback(
    (productId: number) =>
      items.find((i) => i.product.id === productId)?.quantity ?? 0,
    [items]
  );

  const count = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items]
  );

  const total = useMemo(
    () => items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
    [items]
  );

  const value = useMemo(
    () => ({
      items,
      count,
      total,
      addItem,
      removeItem,
      increment,
      decrement,
      clear,
      getQuantity,
    }),
    [
      items,
      count,
      total,
      addItem,
      removeItem,
      increment,
      decrement,
      clear,
      getQuantity,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
