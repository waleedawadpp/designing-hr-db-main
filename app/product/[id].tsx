import React from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import TopBar from "../../components/TopBar";
import { usePrices } from "../../context/PricesContext";
import { DEFAULT_DESCRIPTION, PRIMARY_COLOR, PRIMARY_COLOR_DARK } from "../../config";
import { formatPrice } from "../../lib/format";
import { useCart } from "../../context/CartContext";

export default function ProductDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { addItem, getQuantity } = useCart();
  const { products } = usePrices();

  const product = products.find((p) => String(p.id) === String(id));

  if (!product) {
    return (
      <View className="flex-1 bg-violet-50">
        <TopBar title="المنتج غير موجود" showCart={false} />
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={56} color="#C4B5FD" />
          <Text className="mt-3 text-center text-base font-cairo text-gray-500">
            عذراً، هذا المنتج غير متوفر.
          </Text>
        </View>
      </View>
    );
  }

  const qty = getQuantity(product.id);

  return (
    <View className="flex-1 bg-violet-50">
      <TopBar title="تفاصيل المنتج" />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* صورة كبيرة */}
        <View className="m-4 items-center justify-center rounded-3xl bg-white p-6 shadow-md">
          <Image
            source={product.image}
            className="h-64 w-full"
            resizeMode="contain"
          />
        </View>

        <View className="mx-4 gap-3 rounded-3xl bg-white p-5 shadow-md">
          {/* التصنيف */}
          <View className="flex-row">
            <View
              className="rounded-full px-3 py-1"
              style={{ backgroundColor: "#F3E8FF" }}
            >
              <Text
                className="text-xs font-cairo-bold"
                style={{ color: PRIMARY_COLOR }}
              >
                {product.category}
              </Text>
            </View>
          </View>

          {/* الاسم */}
          <Text
            className="text-2xl font-cairo-extrabold text-gray-900"
            style={{ textAlign: "right", writingDirection: "rtl" }}
          >
            {product.name}
          </Text>

          {/* السعر */}
          <Text
            className="text-xl font-cairo-extrabold"
            style={{ color: PRIMARY_COLOR, textAlign: "right" }}
          >
            {formatPrice(product.price)}
          </Text>

          {/* الوصف */}
          <Text
            className="mt-1 text-base font-cairo leading-7 text-gray-600"
            style={{ textAlign: "right", writingDirection: "rtl" }}
          >
            {DEFAULT_DESCRIPTION}
          </Text>
        </View>
      </ScrollView>

      {/* شريط الإجراء السفلي */}
      <View className="absolute bottom-0 left-0 right-0 border-t border-gray-100 bg-white px-4 pb-8 pt-4 shadow-2xl">
        <Pressable
          onPress={() => {
            addItem(product);
            router.push("/cart");
          }}
          className="overflow-hidden rounded-2xl active:opacity-90"
        >
          <LinearGradient
            colors={[PRIMARY_COLOR, PRIMARY_COLOR_DARK]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="flex-row items-center justify-center gap-2 py-4"
          >
            <Ionicons name="cart-outline" size={22} color="#fff" />
            <Text className="text-base font-cairo-extrabold text-white">
              {qty > 0 ? `أضف للسلة (${qty} في السلة)` : "أضف للسلة"}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}
