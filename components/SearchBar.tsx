import React from "react";
import { TextInput, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  value: string;
  onChange: (text: string) => void;
};

/** خانة البحث عن المنتجات */
export default function SearchBar({ value, onChange }: Props) {
  return (
    <View className="mx-4 -mt-6 flex-row items-center gap-2 rounded-2xl bg-white px-4 py-1 shadow-md">
      <Ionicons name="search-outline" size={20} color="#9CA3AF" />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="ابحث عن مشروبك المفضل..."
        placeholderTextColor="#9CA3AF"
        className="flex-1 py-3 text-base text-gray-800"
        style={{ textAlign: "right", writingDirection: "rtl" }}
        returnKeyType="search"
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChange("")} hitSlop={8}>
          <Ionicons name="close-circle" size={20} color="#9CA3AF" />
        </Pressable>
      )}
    </View>
  );
}
