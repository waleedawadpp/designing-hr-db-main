import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import TopBar from "../components/TopBar";
import { useCart } from "../context/CartContext";
import { formatTotal } from "../lib/format";
import { sendOrderToWhatsApp, CustomerInfo } from "../lib/whatsapp";
import { PRIMARY_COLOR, PRIMARY_COLOR_DARK, WHATSAPP_NUMBER } from "../config";

type Field = {
  label: string;
  value: string;
  onChange: (t: string) => void;
  placeholder: string;
  required?: boolean;
  error?: string;
  keyboardType?: "default" | "phone-pad";
  multiline?: boolean;
};

function FormField({
  label,
  value,
  onChange,
  placeholder,
  required,
  error,
  keyboardType = "default",
  multiline,
}: Field) {
  return (
    <View className="gap-1.5">
      <Text
        className="text-sm font-cairo-bold text-gray-700"
        style={{ textAlign: "right", writingDirection: "rtl" }}
      >
        {label} {required ? <Text className="text-rose-500">*</Text> : null}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType}
        multiline={multiline}
        className="rounded-2xl border bg-white px-4 py-3 text-base font-cairo text-gray-800"
        style={{
          textAlign: "right",
          writingDirection: "rtl",
          borderColor: error ? "#F43F5E" : "#E5E7EB",
          minHeight: multiline ? 80 : undefined,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
      {error ? (
        <Text className="text-xs font-cairo text-rose-500" style={{ textAlign: "right" }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export default function CheckoutScreen() {
  const router = useRouter();
  const { items, total, clear } = useCart();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<{ name?: string; address?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  // إن وصل المستخدم هنا والسلة فارغة نعيده للرئيسية
  if (items.length === 0) {
    return (
      <View className="flex-1 bg-violet-50">
        <TopBar title="إتمام الطلب" showCart={false} />
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="cart-outline" size={64} color="#C4B5FD" />
          <Text className="mt-3 text-center text-base font-cairo text-gray-500">
            سلتك فارغة، أضف منتجات أولاً.
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
              <Text className="text-base font-cairo-bold text-white">
                تصفّح المنتجات
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    );
  }

  const validate = () => {
    const next: { name?: string; address?: string } = {};
    if (!name.trim()) next.name = "الرجاء إدخال الاسم";
    if (!address.trim()) next.address = "الرجاء إدخال العنوان";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    // التأكد من ضبط رقم واتساب في config.ts
    if (!WHATSAPP_NUMBER || WHATSAPP_NUMBER.includes("X")) {
      const msg =
        "الرجاء ضبط رقم واتساب في ملف config.ts (المتغيّر WHATSAPP_NUMBER).";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("رقم واتساب غير مضبوط", msg);
      return;
    }

    const customer: CustomerInfo = {
      name: name.trim(),
      phone: phone.trim() || undefined,
      address: address.trim(),
      notes: notes.trim() || undefined,
    };

    try {
      setSubmitting(true);
      await sendOrderToWhatsApp(items, total, customer);
      clear(); // تفريغ السلة بعد الإرسال
      router.replace("/order-success");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-violet-50">
      <TopBar title="إتمام الطلب" showCart={false} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 140, gap: 16 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ملخّص الطلب */}
          <View className="gap-2 rounded-3xl bg-white p-4 shadow-sm">
            <Text
              className="text-base font-cairo-extrabold text-gray-800"
              style={{ textAlign: "right" }}
            >
              ملخّص الطلب
            </Text>
            {items.map((item) => (
              <View
                key={item.product.id}
                className="flex-row items-center justify-between"
              >
                <Text
                  className="flex-1 text-sm font-cairo text-gray-600"
                  numberOfLines={1}
                  style={{ textAlign: "right" }}
                >
                  {item.product.name}
                </Text>
                <Text className="ml-2 text-sm font-cairo-bold text-gray-700">
                  × {item.quantity}
                </Text>
              </View>
            ))}
            <View className="mt-1 flex-row items-center justify-between border-t border-gray-100 pt-2">
              <Text className="text-sm font-cairo text-gray-500">المجموع الكلي</Text>
              <Text
                className="text-lg font-cairo-extrabold"
                style={{ color: PRIMARY_COLOR }}
              >
                {formatTotal(total)}
              </Text>
            </View>
          </View>

          {/* نموذج بيانات الزبون */}
          <View className="gap-4 rounded-3xl bg-white p-4 shadow-sm">
            <Text
              className="text-base font-cairo-extrabold text-gray-800"
              style={{ textAlign: "right" }}
            >
              بياناتك
            </Text>

            <FormField
              label="الاسم"
              value={name}
              onChange={(t) => {
                setName(t);
                if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
              }}
              placeholder="اكتب اسمك الكامل"
              required
              error={errors.name}
            />

            <FormField
              label="رقم الهاتف"
              value={phone}
              onChange={setPhone}
              placeholder="مثال: 9XXXXXXX"
              keyboardType="phone-pad"
            />

            <FormField
              label="العنوان"
              value={address}
              onChange={(t) => {
                setAddress(t);
                if (errors.address)
                  setErrors((e) => ({ ...e, address: undefined }));
              }}
              placeholder="المنطقة، الشارع، رقم المنزل..."
              required
              error={errors.address}
              multiline
            />

            <FormField
              label="ملاحظات (اختياري)"
              value={notes}
              onChange={setNotes}
              placeholder="أي تفاصيل إضافية لطلبك"
              multiline
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* زر الإرسال */}
      <View className="absolute bottom-0 left-0 right-0 gap-2 rounded-t-[28px] border-t border-gray-100 bg-white px-5 pb-8 pt-4 shadow-2xl">
        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          className="overflow-hidden rounded-2xl active:opacity-90"
          style={{ opacity: submitting ? 0.7 : 1 }}
        >
          <LinearGradient
            colors={["#22C55E", "#16A34A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="flex-row items-center justify-center gap-2 py-4"
          >
            <Ionicons name="logo-whatsapp" size={24} color="#fff" />
            <Text className="text-base font-cairo-extrabold text-white">
              {submitting ? "جارٍ الإرسال..." : "إرسال الطلب عبر واتساب"}
            </Text>
          </LinearGradient>
        </Pressable>
        <Text className="text-center text-xs font-cairo text-gray-400">
          سيتم فتح واتساب برسالة جاهزة تحتوي طلبك وبياناتك
        </Text>
      </View>
    </View>
  );
}
