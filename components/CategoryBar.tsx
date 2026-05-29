import React from "react";
import { Pressable, ScrollView, Text } from "react-native";
import { PRIMARY_COLOR } from "../config";
import { Category } from "../data/products";

type Props = {
  categories: Category[];
  selected: Category | "الكل";
  onSelect: (category: Category | "الكل") => void;
};

/** شريط التصنيفات الأفقي القابل للتمرير */
export default function CategoryBar({ categories, selected, onSelect }: Props) {
  const all: (Category | "الكل")[] = ["الكل", ...categories];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: 16,
        gap: 8,
        flexDirection: "row",
      }}
      className="mt-4 max-h-12 grow-0"
    >
      {all.map((cat) => {
        const active = selected === cat;
        return (
          <Pressable
            key={cat}
            onPress={() => onSelect(cat)}
            className="rounded-full px-4 py-2 active:opacity-80"
            style={{
              backgroundColor: active ? PRIMARY_COLOR : "#F3F4F6",
            }}
          >
            <Text
              className="text-sm font-cairo-bold"
              style={{ color: active ? "#fff" : "#4B5563" }}
            >
              {cat}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
