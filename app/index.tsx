import React, { useMemo, useState } from "react";
import {
  FlatList,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Header from "../components/Header";
import SearchBar from "../components/SearchBar";
import CategoryBar from "../components/CategoryBar";
import ProductCard from "../components/ProductCard";
import { CATEGORIES, Category } from "../data/products";
import { usePrices } from "../context/PricesContext";

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "الكل">("الكل");
  const { products } = usePrices();

  // عدد الأعمدة حسب عرض الشاشة (متجاوب): جوال = 2، تابلت/ويب = أكثر
  const numColumns = Math.min(5, Math.max(2, Math.floor(width / 240)));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const matchCat = category === "الكل" || p.category === category;
      const matchQuery = q === "" || p.name.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [query, category, products]);

  // إضافة عناصر فارغة لموازنة الصف الأخير حتى لا يتمدّد منتج وحيد على كامل العرض
  const data = useMemo(() => {
    if (numColumns <= 1) return filtered;
    const remainder = filtered.length % numColumns;
    if (remainder === 0) return filtered;
    const fillers = Array.from({ length: numColumns - remainder }, (_, i) => ({
      id: -(i + 1),
      __filler: true as const,
    }));
    return [...filtered, ...(fillers as unknown as typeof filtered)];
  }, [filtered, numColumns]);

  return (
    <View className="flex-1 bg-violet-50">
      <FlatList
        // key يجبر FlatList على إعادة التخطيط عند تغيّر عدد الأعمدة
        key={numColumns}
        data={data}
        keyExtractor={(item) => String(item.id)}
        numColumns={numColumns}
        columnWrapperStyle={
          numColumns > 1 ? { gap: 12, paddingHorizontal: 16 } : undefined
        }
        contentContainerStyle={{ paddingBottom: 32, gap: 12 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <Header />
            <SearchBar value={query} onChange={setQuery} />
            <CategoryBar
              categories={CATEGORIES}
              selected={category}
              onSelect={setCategory}
            />
            <Text
              className="mt-5 px-4 text-lg font-cairo-extrabold text-gray-800"
              style={{ textAlign: "right", writingDirection: "rtl" }}
            >
              {category === "الكل" ? "كل المنتجات" : category}
              <Text className="text-sm font-cairo text-gray-400">
                {"  "}({filtered.length})
              </Text>
            </Text>
          </View>
        }
        renderItem={({ item }) =>
          (item as any).__filler ? (
            // عنصر فارغ غير مرئي لموازنة الشبكة
            <View className="flex-1" />
          ) : (
            <ProductCard product={item} />
          )
        }
        ListEmptyComponent={
          <View className="mt-20 items-center px-8">
            <Ionicons name="sad-outline" size={56} color="#C4B5FD" />
            <Text className="mt-3 text-center text-base font-cairo text-gray-500">
              لا توجد منتجات مطابقة لبحثك
            </Text>
          </View>
        }
      />
    </View>
  );
}
