import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCart } from "../context/CartContext";

/** زر السلة مع شارة العدّاد، يُستخدم في الرؤوس */
export default function CartButton({ color = "#fff" }: { color?: string }) {
  const router = useRouter();
  const { count } = useCart();

  return (
    <Pressable
      onPress={() => router.push("/cart")}
      className="active:opacity-70"
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="السلة"
    >
      <View className="h-11 w-11 items-center justify-center rounded-full bg-white/20">
        <Ionicons name="cart-outline" size={24} color={color} />
      </View>
      {count > 0 && (
        <View
          className="absolute -top-1 -right-1 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1"
          style={{ height: 20 }}
        >
          <Text className="text-[11px] font-bold text-white">{count}</Text>
        </View>
      )}
    </Pressable>
  );
}
