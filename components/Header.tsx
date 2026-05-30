import React from "react";
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { STORE_NAME, PRIMARY_COLOR, PRIMARY_COLOR_DARK } from "../config";
import CartButton from "./CartButton";

/** رأس الصفحة الرئيسية: شعار + اسم المتجر + زر السلة، بخلفية متدرّجة */
export default function Header() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <LinearGradient
      colors={[PRIMARY_COLOR, PRIMARY_COLOR_DARK]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ paddingTop: insets.top + 12 }}
      className="rounded-b-[28px] px-5 pb-6 shadow-lg"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          {/* ضغطة مطوّلة على الشعار تفتح لوحة الأدمن (مدخل خفي) */}
          <Pressable
            onLongPress={() => router.push("/admin" as never)}
            delayLongPress={700}
            className="h-12 w-12 items-center justify-center rounded-2xl bg-white/20"
            accessibilityLabel="شعار المتجر"
          >
            <Ionicons name="wine-outline" size={26} color="#fff" />
          </Pressable>
          <View>
            <Text className="text-xl font-cairo-extrabold text-white" style={{ writingDirection: "rtl" }}>
              {STORE_NAME}
            </Text>
            <Text className="text-xs font-cairo text-white/80" style={{ writingDirection: "rtl" }}>
              مشروبات منعشة توصل لباب بيتك
            </Text>
          </View>
        </View>
        <CartButton />
      </View>
    </LinearGradient>
  );
}
