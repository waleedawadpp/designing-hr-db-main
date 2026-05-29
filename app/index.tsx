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
import { CATEGORIES, Category, PRODUCTS } from "../data/products";

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "الكل">("الكل");

  // عدد الأعمدة حسب عرض الشاشة (متجاوب): جوال = 2، تابلت/ويب = أكثر
  const numColumns = Math.min(5, Math.max(2, Math.floor(width / 240)));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PRODUCTS.filter((p) => {
      const matchCat = category === "الكل" || p.category === category;
      const matchQuery = q === "" || p.name.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [query, category]);

  return (
    <View className="flex-1 bg-violet-50">
      <FlatList
        // key يجبر FlatList على إعادة التخطيط عند تغيّر عدد الأعمدة
        key={numColumns}
        data={filtered}
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
              className="mt-5 px-4 text-lg font-extrabold text-gray-800"
              style={{ textAlign: "right", writingDirection: "rtl" }}
            >
              {category === "الكل" ? "كل المنتجات" : category}
              <Text className="text-sm font-normal text-gray-400">
                {"  "}({filtered.length})
              </Text>
            </Text>
          </View>
        }
        renderItem={({ item }) => <ProductCard product={item} />}
        ListEmptyComponent={
          <View className="mt-20 items-center px-8">
            <Ionicons name="sad-outline" size={56} color="#C4B5FD" />
            <Text className="mt-3 text-center text-base text-gray-500">
              لا توجد منتجات مطابقة لبحثك
            </Text>
          </View>
        }
      />
    </View>
  );
}
