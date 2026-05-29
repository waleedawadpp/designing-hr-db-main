import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PRIMARY_COLOR } from "../config";

type Props = {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
};

/** عنصر التحكم بالكمية (+/−) في السلة */
export default function QtyStepper({
  quantity,
  onIncrement,
  onDecrement,
}: Props) {
  return (
    <View className="flex-row items-center gap-3 rounded-full bg-gray-100 px-2 py-1">
      <Pressable
        onPress={onDecrement}
        className="h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm active:opacity-70"
        hitSlop={6}
        accessibilityLabel="إنقاص الكمية"
      >
        <Ionicons name="remove" size={18} color={PRIMARY_COLOR} />
      </Pressable>

      <Text className="min-w-[20px] text-center text-base font-bold text-gray-800">
        {quantity}
      </Text>

      <Pressable
        onPress={onIncrement}
        className="h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm active:opacity-70"
        hitSlop={6}
        accessibilityLabel="زيادة الكمية"
      >
        <Ionicons name="add" size={18} color={PRIMARY_COLOR} />
      </Pressable>
    </View>
  );
}
