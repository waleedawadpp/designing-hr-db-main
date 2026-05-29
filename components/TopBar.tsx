import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PRIMARY_COLOR, PRIMARY_COLOR_DARK } from "../config";
import CartButton from "./CartButton";

type Props = {
  title: string;
  showCart?: boolean;
};

/** رأس علوي للصفحات الداخلية مع زر رجوع */
export default function TopBar({ title, showCart = true }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={[PRIMARY_COLOR, PRIMARY_COLOR_DARK]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ paddingTop: insets.top + 10 }}
      className="rounded-b-[24px] px-4 pb-4"
    >
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          className="h-11 w-11 items-center justify-center rounded-full bg-white/20 active:opacity-70"
          accessibilityLabel="رجوع"
        >
          {/* في وضع RTL يكون الرجوع نحو اليمين */}
          <Ionicons name="chevron-forward" size={24} color="#fff" />
        </Pressable>

        <Text className="flex-1 px-3 text-center text-lg font-extrabold text-white">
          {title}
        </Text>

        {showCart ? <CartButton /> : <View className="h-11 w-11" />}
      </View>
    </LinearGradient>
  );
}
