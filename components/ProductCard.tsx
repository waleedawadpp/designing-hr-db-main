import React, { useRef } from "react";
import { Animated, Image, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { PRIMARY_COLOR, PRIMARY_COLOR_DARK } from "../config";
import { Product } from "../data/products";
import { formatPrice } from "../lib/format";
import { useCart } from "../context/CartContext";

/** بطاقة منتج واحدة في الشبكة */
export default function ProductCard({ product }: { product: Product }) {
  const router = useRouter();
  const { addItem, getQuantity } = useCart();
  const scale = useRef(new Animated.Value(1)).current;
  const qty = getQuantity(product.id);

  const pressIn = () =>
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
    }).start();

  const pressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
    }).start();

  return (
    <Animated.View style={{ transform: [{ scale }], flex: 1 }}>
      <Pressable
        onPress={() => router.push(`/product/${product.id}`)}
        onPressIn={pressIn}
        onPressOut={pressOut}
        className="flex-1 overflow-hidden rounded-3xl bg-white shadow-md"
      >
        {/* الصورة */}
        <View className="items-center justify-center bg-violet-50 p-3">
          <Image
            source={product.image}
            className="h-32 w-full"
            resizeMode="contain"
          />
        </View>

        {/* المعلومات */}
        <View className="gap-2 p-3">
          <Text
            numberOfLines={2}
            className="min-h-[40px] text-sm font-cairo-bold text-gray-800"
            style={{ textAlign: "right", writingDirection: "rtl" }}
          >
            {product.name}
          </Text>

          <View className="flex-row items-center justify-between">
            <Text
              className="text-sm font-cairo-extrabold"
              style={{ color: PRIMARY_COLOR }}
            >
              {formatPrice(product.price)}
            </Text>
          </View>

          {/* زر الإضافة */}
          <Pressable
            onPress={() => addItem(product)}
            className="overflow-hidden rounded-2xl active:opacity-90"
          >
            <LinearGradient
              colors={[PRIMARY_COLOR, PRIMARY_COLOR_DARK]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="flex-row items-center justify-center gap-1.5 py-2.5"
            >
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text className="text-sm font-cairo-bold text-white">
                {qty > 0 ? `في السلة (${qty})` : "أضف للسلة"}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}
