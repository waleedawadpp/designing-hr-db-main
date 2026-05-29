import React from "react";
import {
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import TopBar from "../components/TopBar";
import QtyStepper from "../components/QtyStepper";
import { useCart } from "../context/CartContext";
import { formatPrice, formatTotal } from "../lib/format";
import { sendOrderToWhatsApp } from "../lib/whatsapp";
import { PRIMARY_COLOR, PRIMARY_COLOR_DARK, WHATSAPP_NUMBER } from "../config";

export default function CartScreen() {
  const router = useRouter();
  const { items, total, increment, decrement, removeItem, clear } = useCart();

  const handleCheckout = async () => {
    if (items.length === 0) return;

    if (
      !WHATSAPP_NUMBER ||
      WHATSAPP_NUMBER.includes("X")
    ) {
      const msg =
        "الرجاء ضبط رقم واتساب في ملف config.ts (المتغيّر WHATSAPP_NUMBER).";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("رقم واتساب غير مضبوط", msg);
      return;
    }

    await sendOrderToWhatsApp(items, total);
  };

  if (items.length === 0) {
    return (
      <View className="flex-1 bg-violet-50">
        <TopBar title="سلة المشتريات" showCart={false} />
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="cart-outline" size={72} color="#C4B5FD" />
          <Text className="mt-4 text-center text-lg font-bold text-gray-600">
            سلتك فارغة
          </Text>
          <Text className="mt-1 text-center text-sm text-gray-400">
            تصفّح المنتجات وأضف ما يعجبك
          </Text>
          <Pressable
            onPress={() => router.replace("/")}
            className="mt-6 overflow-hidden rounded-2xl active:opacity-90"
          >
            <LinearGradient
              colors={[PRIMARY_COLOR, PRIMARY_COLOR_DARK]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="px-8 py-3"
            >
              <Text className="text-base font-bold text-white">
                تصفّح المنتجات
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-violet-50">
      <TopBar title="سلة المشتريات" showCart={false} />

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.product.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 220, gap: 12 }}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          <Pressable
            onPress={clear}
            className="mt-2 flex-row items-center justify-center gap-1.5 py-2 active:opacity-70"
          >
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
            <Text className="text-sm font-bold text-rose-500">
              إفراغ السلة
            </Text>
          </Pressable>
        }
        renderItem={({ item }) => (
          <View className="flex-row items-center gap-3 rounded-3xl bg-white p-3 shadow-sm">
            <View className="h-20 w-20 items-center justify-center rounded-2xl bg-violet-50 p-1">
              <Image
                source={item.product.image}
                className="h-full w-full"
                resizeMode="contain"
              />
            </View>

            <View className="flex-1 gap-2">
              <Text
                numberOfLines={2}
                className="text-sm font-bold text-gray-800"
                style={{ textAlign: "right", writingDirection: "rtl" }}
              >
                {item.product.name}
              </Text>

              <Text
                className="text-sm font-extrabold"
                style={{ color: PRIMARY_COLOR, textAlign: "right" }}
              >
                {formatPrice(item.product.price)}
              </Text>

              <View className="flex-row items-center justify-between">
                <QtyStepper
                  quantity={item.quantity}
                  onIncrement={() => increment(item.product.id)}
                  onDecrement={() => decrement(item.product.id)}
                />
                <Pressable
                  onPress={() => removeItem(item.product.id)}
                  hitSlop={8}
                  accessibilityLabel="حذف المنتج"
                >
                  <Ionicons name="close-circle" size={24} color="#D1D5DB" />
                </Pressable>
              </View>
            </View>
          </View>
        )}
      />

      {/* ملخّص الطلب وزر الإتمام */}
      <View className="absolute bottom-0 left-0 right-0 gap-3 rounded-t-[28px] border-t border-gray-100 bg-white px-5 pb-8 pt-5 shadow-2xl">
        <View className="flex-row items-center justify-between">
          <Text className="text-base text-gray-500">المجموع الكلي</Text>
          <Text
            className="text-2xl font-extrabold"
            style={{ color: PRIMARY_COLOR }}
          >
            {formatTotal(total)}
          </Text>
        </View>

        <Pressable
          onPress={handleCheckout}
          className="overflow-hidden rounded-2xl active:opacity-90"
        >
          <LinearGradient
            colors={["#22C55E", "#16A34A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="flex-row items-center justify-center gap-2 py-4"
          >
            <Ionicons name="logo-whatsapp" size={24} color="#fff" />
            <Text className="text-base font-extrabold text-white">
              إتمام الطلب عبر واتساب
            </Text>
          </LinearGradient>
        </Pressable>

        <Text className="text-center text-xs text-gray-400">
          سيتم فتح واتساب برسالة جاهزة تحتوي تفاصيل طلبك
        </Text>
      </View>
    </View>
  );
}
