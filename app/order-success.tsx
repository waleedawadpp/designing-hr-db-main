import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PRIMARY_COLOR, PRIMARY_COLOR_DARK, STORE_NAME } from "../config";

export default function OrderSuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 items-center justify-center bg-violet-50 px-8"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      {/* دائرة علامة الصح */}
      <View className="h-28 w-28 items-center justify-center rounded-full bg-green-100">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-green-500">
          <Ionicons name="checkmark" size={48} color="#fff" />
        </View>
      </View>

      <Text className="mt-6 text-center text-2xl font-cairo-extrabold text-gray-900">
        تم إرسال طلبك!
      </Text>

      <Text className="mt-2 text-center text-base font-cairo leading-7 text-gray-500">
        تم تحويلك إلى واتساب لإكمال الطلب مع {STORE_NAME}.{"\n"}
        سنتواصل معك لتأكيد الطلب والتوصيل.
      </Text>

      <Text className="mt-1 text-center text-sm font-cairo text-gray-400">
        إذا لم يفتح واتساب تلقائياً، تأكّد من تثبيته ثم أعد المحاولة.
      </Text>

      <Pressable
        onPress={() => router.replace("/")}
        className="mt-8 w-full max-w-xs overflow-hidden rounded-2xl active:opacity-90"
      >
        <LinearGradient
          colors={[PRIMARY_COLOR, PRIMARY_COLOR_DARK]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          className="flex-row items-center justify-center gap-2 py-4"
        >
          <Ionicons name="home-outline" size={22} color="#fff" />
          <Text className="text-base font-cairo-extrabold text-white">
            العودة للمتجر
          </Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}
