// ============================================================
// app/admin.tsx
// لوحة الأدمن لتعديل الأسعار.
// ـ محمية برمز PIN (config.ts ADMIN_PIN).
// ـ تعرض كل المنتجات مع حقل سعر قابل للتعديل، وزر حفظ.
// ـ تُحفظ الأسعار سحابياً (Firebase) إن فُعّل، وإلا محلياً.
// ============================================================

import React, { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import TopBar from "../components/TopBar";
import { usePrices } from "../context/PricesContext";
import { ADMIN_PIN, CURRENCY, PRIMARY_COLOR, PRIMARY_COLOR_DARK } from "../config";
import type { PriceMap } from "../lib/prices";

export default function AdminScreen() {
  const { products, prices, cloud, updatePrices } = usePrices();

  // ------- بوابة الرمز السري -------
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);

  // ------- مسوّدة الأسعار (نص لكل منتج) -------
  const [draft, setDraft] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      products.map((p) => [
        p.id,
        prices[p.id] != null ? String(prices[p.id]) : "",
      ])
    )
  );
  const [saving, setSaving] = useState(false);

  const filledCount = useMemo(
    () => Object.values(draft).filter((v) => v.trim() !== "").length,
    [draft]
  );

  const tryUnlock = () => {
    if (pin === ADMIN_PIN) {
      setAuthed(true);
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  const handleSave = async () => {
    const next: PriceMap = {};
    for (const p of products) {
      const raw = (draft[p.id] ?? "").trim();
      if (raw === "") continue;
      const num = Number(raw.replace(",", "."));
      if (!Number.isNaN(num) && num >= 0) next[p.id] = num;
    }
    try {
      setSaving(true);
      await updatePrices(next);
      const msg = cloud
        ? "تم حفظ الأسعار وتزامنها مع كل الأجهزة."
        : "تم حفظ الأسعار على هذا الجهاز.";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("تم الحفظ", msg);
    } catch (e) {
      const msg = "تعذّر حفظ الأسعار، تحقّق من الاتصال.";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("خطأ", msg);
    } finally {
      setSaving(false);
    }
  };

  // ---------------- شاشة الرمز السري ----------------
  if (!authed) {
    return (
      <View className="flex-1 bg-violet-50">
        <TopBar title="لوحة الأدمن" showCart={false} />
        <View className="flex-1 items-center justify-center px-8">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-violet-100">
            <Ionicons name="lock-closed" size={36} color={PRIMARY_COLOR} />
          </View>
          <Text className="mt-5 text-center text-lg font-cairo-extrabold text-gray-800">
            أدخل رمز الدخول
          </Text>
          <Text className="mt-1 text-center text-sm font-cairo text-gray-500">
            هذه الشاشة مخصّصة لإدارة الأسعار
          </Text>

          <TextInput
            value={pin}
            onChangeText={(t) => {
              setPin(t);
              if (pinError) setPinError(false);
            }}
            placeholder="• • • •"
            placeholderTextColor="#9CA3AF"
            keyboardType="number-pad"
            secureTextEntry
            onSubmitEditing={tryUnlock}
            className="mt-6 w-48 rounded-2xl border bg-white px-4 py-3 text-center text-xl font-cairo-bold text-gray-800"
            style={{ borderColor: pinError ? "#F43F5E" : "#E5E7EB" }}
          />
          {pinError ? (
            <Text className="mt-2 text-sm font-cairo text-rose-500">
              رمز غير صحيح، حاول مجدداً
            </Text>
          ) : null}

          <Pressable
            onPress={tryUnlock}
            className="mt-6 w-48 overflow-hidden rounded-2xl active:opacity-90"
          >
            <LinearGradient
              colors={[PRIMARY_COLOR, PRIMARY_COLOR_DARK]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="items-center py-3"
            >
              <Text className="text-base font-cairo-bold text-white">دخول</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    );
  }

  // ---------------- شاشة تعديل الأسعار ----------------
  return (
    <View className="flex-1 bg-violet-50">
      <TopBar title="تعديل الأسعار" showCart={false} />

      {/* شريط حالة التخزين */}
      <View
        className="mx-4 mt-3 flex-row items-center gap-2 rounded-2xl px-4 py-2.5"
        style={{ backgroundColor: cloud ? "#DCFCE7" : "#FEF9C3" }}
      >
        <Ionicons
          name={cloud ? "cloud-done-outline" : "phone-portrait-outline"}
          size={18}
          color={cloud ? "#16A34A" : "#CA8A04"}
        />
        <Text className="flex-1 text-xs font-cairo text-gray-700">
          {cloud
            ? "التزامن السحابي مفعّل — التعديلات تظهر لكل الزبائن."
            : "تخزين محلي — التعديلات على هذا الجهاز فقط (فعّل Firebase للتزامن)."}
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <FlatList
          data={products}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 140, gap: 10 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View className="flex-row items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
              <View className="flex-1">
                <Text
                  numberOfLines={2}
                  className="text-sm font-cairo-bold text-gray-800"
                  style={{ textAlign: "right", writingDirection: "rtl" }}
                >
                  {item.name}
                </Text>
                <Text
                  className="text-xs font-cairo text-gray-400"
                  style={{ textAlign: "right" }}
                >
                  {item.category} · #{item.id}
                </Text>
              </View>

              <View className="flex-row items-center gap-1.5">
                <TextInput
                  value={draft[item.id] ?? ""}
                  onChangeText={(t) =>
                    setDraft((d) => ({ ...d, [item.id]: t }))
                  }
                  placeholder="0.000"
                  placeholderTextColor="#C4B5FD"
                  keyboardType="decimal-pad"
                  className="w-24 rounded-xl border border-gray-200 bg-violet-50 px-3 py-2 text-center text-base font-cairo-bold text-gray-800"
                />
                <Text className="text-xs font-cairo text-gray-400">
                  {CURRENCY}
                </Text>
              </View>
            </View>
          )}
        />
      </KeyboardAvoidingView>

      {/* شريط الحفظ السفلي */}
      <View className="absolute bottom-0 left-0 right-0 gap-2 rounded-t-[28px] border-t border-gray-100 bg-white px-5 pb-8 pt-4 shadow-2xl">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-cairo text-gray-500">
            مُسعّر: {filledCount} / {products.length}
          </Text>
        </View>
        <Pressable
          onPress={handleSave}
          disabled={saving}
          className="overflow-hidden rounded-2xl active:opacity-90"
          style={{ opacity: saving ? 0.7 : 1 }}
        >
          <LinearGradient
            colors={[PRIMARY_COLOR, PRIMARY_COLOR_DARK]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="flex-row items-center justify-center gap-2 py-4"
          >
            <Ionicons name="save-outline" size={22} color="#fff" />
            <Text className="text-base font-cairo-extrabold text-white">
              {saving ? "جارٍ الحفظ..." : "حفظ الأسعار"}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}
