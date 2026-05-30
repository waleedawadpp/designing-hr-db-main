import "../global.css";

import React, { useCallback, useEffect } from "react";
import { I18nManager, Platform, Text, TextInput } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Cairo_400Regular,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
} from "@expo-google-fonts/cairo";
import { CartProvider } from "../context/CartContext";
import { PricesProvider } from "../context/PricesContext";

// تفعيل الاتجاه من اليمين لليسار (RTL) على كل المنصّات
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

// إبقاء شاشة البداية ظاهرة حتى تنتهي الخطوط من التحميل
SplashScreen.preventAutoHideAsync().catch(() => {});

// خط افتراضي عربي (Cairo) لأي نص لا يحدّد خطاً صراحةً
const TextAny = Text as unknown as { defaultProps?: { style?: unknown } };
const TextInputAny = TextInput as unknown as { defaultProps?: { style?: unknown } };
TextAny.defaultProps = TextAny.defaultProps || {};
TextAny.defaultProps.style = { fontFamily: "Cairo_400Regular" };
TextInputAny.defaultProps = TextInputAny.defaultProps || {};
TextInputAny.defaultProps.style = { fontFamily: "Cairo_400Regular" };

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Cairo_400Regular,
    Cairo_600SemiBold,
    Cairo_700Bold,
    Cairo_800ExtraBold,
  });

  useEffect(() => {
    // على الويب: ضبط اتجاه الصفحة ولغتها لدعم العربية و RTL
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.documentElement.setAttribute("dir", "rtl");
      document.documentElement.setAttribute("lang", "ar");
    }
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  // على الجوال: ننتظر جاهزية الخطوط (شاشة البداية تغطّي الانتظار).
  // على الويب: نعرض الواجهة فوراً بخط احتياطي ثم يحلّ خط Cairo محلّه.
  if (Platform.OS !== "web" && !fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider onLayout={onLayoutRootView}>
      <PricesProvider>
        <CartProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#F5F3FF" },
              animation: "slide_from_left",
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="product/[id]" />
            <Stack.Screen name="cart" />
            <Stack.Screen name="checkout" />
            <Stack.Screen name="order-success" />
            <Stack.Screen name="admin" />
          </Stack>
        </CartProvider>
      </PricesProvider>
    </SafeAreaProvider>
  );
}
