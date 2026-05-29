# 🥤 متجر المشروبات — Drinks Store

متجر مشروبات عصري بقاعدة كود **واحدة** تعمل على **الويب + أندرويد + آيفون** معاً،
مبني بـ **Expo + Expo Router + TypeScript + NativeWind (Tailwind)**.

- بدون دفع إلكتروني، بدون تسجيل دخول، بدون لوحة تحكم.
- الزبون يتصفّح المنتجات ويرسل طلبه **مباشرة عبر واتساب**.
- دعم كامل للعربية والاتجاه من اليمين لليسار (RTL).
- بيانات المنتجات محلية في ملف واحد — بدون خادم أو قاعدة بيانات.

> ملاحظة: هذا المستودع كان يحوي مشروع قاعدة بيانات HR، وتجد توثيقه القديم في
> `README-HR-legacy.md`.

---

## 🗂️ شجرة المشروع

```
.
├── app/                       # الشاشات (Expo Router - file based routing)
│   ├── _layout.tsx            # التهيئة العامة: RTL + مزوّد السلة + Stack
│   ├── index.tsx              # الشاشة الرئيسية (بحث + تصنيفات + شبكة منتجات)
│   ├── cart.tsx               # شاشة السلة + إتمام الطلب عبر واتساب
│   └── product/
│       └── [id].tsx           # شاشة تفاصيل المنتج
├── components/                # مكوّنات واجهة قابلة لإعادة الاستخدام
│   ├── Header.tsx             # رأس الصفحة الرئيسية (شعار + اسم المتجر + سلة)
│   ├── TopBar.tsx             # رأس الصفحات الداخلية مع زر رجوع
│   ├── SearchBar.tsx          # خانة البحث
│   ├── CategoryBar.tsx        # شريط التصنيفات الأفقي
│   ├── ProductCard.tsx        # بطاقة المنتج (مع حركة ضغط)
│   ├── QtyStepper.tsx         # التحكم بالكمية (+/−)
│   └── CartButton.tsx         # زر السلة مع شارة العدّاد
├── context/
│   └── CartContext.tsx        # حالة السلة (إضافة/حذف/كمية/مجموع)
├── data/
│   └── products.ts            # ★ قائمة المنتجات (id, name, price, category, image)
├── lib/
│   ├── format.ts              # تنسيق الأسعار والعملة
│   └── whatsapp.ts            # بناء رابط واتساب وفتحه
├── assets/
│   ├── images/                # ★ صور المنتجات (placeholder — استبدلها بصورك)
│   ├── icon.png               # أيقونة التطبيق
│   ├── adaptive-icon.png      # أيقونة أندرويد التكيّفية
│   ├── splash-icon.png        # شاشة البداية
│   └── favicon.png            # أيقونة الويب
├── scripts/
│   └── generate.js            # مولّد data/products.ts والصور البديلة (اختياري)
├── config.ts                  # ★ إعدادات المتجر (الاسم، رقم واتساب، اللون...)
├── app.json                   # إعدادات Expo
├── babel.config.js            # Babel (NativeWind + Reanimated)
├── metro.config.js            # Metro (NativeWind)
├── tailwind.config.js         # إعدادات Tailwind
├── global.css                 # توجيهات Tailwind
├── tsconfig.json
└── package.json
```

> الملفات المعلّمة بـ ★ هي التي ستعدّلها عادةً.

---

## ⚙️ المتطلبات

- [Node.js](https://nodejs.org/) إصدار 18 أو أحدث.
- تطبيق **Expo Go** على هاتفك (من App Store / Google Play) للتجربة السريعة.
- (لبناء التطبيقات) حساب مجاني على [expo.dev](https://expo.dev).

---

## 🚀 التشغيل خطوة بخطوة

### 1) تثبيت الاعتماديات

```bash
npm install
```

### 2) تشغيل المشروع

```bash
npx expo start
```

سيظهر رمز QR في الطرفية. ومن نفس النافذة يمكنك:

- الضغط على `w` لفتح **نسخة الويب** في المتصفح.
- الضغط على `a` لفتح **محاكي أندرويد** (إن كان مثبتاً).
- الضغط على `i` لفتح **محاكي آيفون** (على macOS فقط).

### 3) التجربة على الجوال عبر Expo Go

1. ثبّت تطبيق **Expo Go** على هاتفك.
2. تأكّد أن الهاتف والكمبيوتر على **نفس شبكة Wi‑Fi**.
3. امسح رمز QR الظاهر في الطرفية:
   - أندرويد: من داخل تطبيق Expo Go.
   - آيفون: من تطبيق الكاميرا مباشرة.

> إذا واجهت مشكلة في الشبكة جرّب: `npx expo start --tunnel`.

### 4) تجربة الويب فقط

```bash
npm run web
```

---

## 📱 بناء تطبيقَي iOS و Android عبر EAS Build

EAS Build يبني ملفات التطبيق على سحابة Expo (لا تحتاج Mac لبناء iOS).

```bash
# 1) ثبّت أداة EAS (مرة واحدة)
npm install -g eas-cli

# 2) سجّل الدخول بحساب Expo
eas login

# 3) هيّئ المشروع للبناء (يُنشئ eas.json)
eas build:configure

# 4) بناء أندرويد (ملف APK/AAB)
eas build --platform android

# 5) بناء آيفون (يتطلّب حساب Apple Developer)
eas build --platform ios

# لبناء المنصّتين معاً
eas build --platform all
```

بعد انتهاء البناء سيعطيك رابطاً لتحميل الملف الناتج وتثبيته أو رفعه للمتاجر.

### نشر نسخة الويب (اختياري)

```bash
npx expo export --platform web      # يُنتج مجلد dist/ جاهزاً للاستضافة
```
ثم ارفع مجلد `dist/` لأي استضافة ثابتة (Netlify, Vercel, GitHub Pages...).

---

## 🛠️ التخصيص السريع

كل الإعدادات الأساسية في ملف **`config.ts`**:

```ts
export const STORE_NAME = "اسم متجرك";
export const WHATSAPP_NUMBER = "9689XXXXXXXX"; // صيغة دولية بدون + وبدون أصفار بادئة
export const CURRENCY = "ر.ع.";
export const PRIMARY_COLOR = "#7C3AED";
```

### ✅ تغيير رقم واتساب
عدّل `WHATSAPP_NUMBER` في `config.ts`.
- اكتبه بالصيغة الدولية **بدون** علامة `+` وبدون أصفار بادئة.
- مثال لسلطنة عُمان: `9689XXXXXXXX` (968 رمز الدولة ثم الرقم).

### ✅ تعديل اللون الأساسي
1. غيّر `PRIMARY_COLOR` (و`PRIMARY_COLOR_DARK` للتدرّج) في `config.ts`.
2. للحصول على تطابق كامل في كل مكان، غيّر أيضاً قيمة `brand` في `tailwind.config.js`.

### ✅ إضافة الأسعار
الأسعار حالياً `price: 0` (تظهر كـ "السعر عند الطلب"). افتح `data/products.ts`
واستبدل القيمة لكل منتج، مثال:

```ts
{
  id: 5,
  name: "TEA TIME ICE TEA PEACH 330ML",
  price: 0.350,            // ← ضع السعر هنا (بدّل 0)
  category: "TEA TIME",
  image: require("../assets/images/tea-time-ice-tea-peach-330ml.png"),
},
```
كل المنتجات عليها تعليق `// TODO: أضف السعر` لتسهيل إيجادها.

### ✅ إضافة منتج جديد
أضف عنصراً جديداً في مصفوفة `PRODUCTS` داخل `data/products.ts`:

```ts
{
  id: 100,                                   // رقم فريد
  name: "اسم المنتج الجديد",
  price: 0.500,
  category: "SUPER",                          // أحد التصنيفات المعرّفة في Category
  image: require("../assets/images/my-new-drink.png"), // مسار ثابت صريح
},
```
> مهم: مسار `require` يجب أن يكون **نصاً ثابتاً صريحاً** (لا تبنِه من متغيّر)
> لأن حزمة Metro تحتاج المسار معروفاً وقت البناء.

### ✅ استبدال صورة منتج
1. ضع صورتك (PNG، يُفضّل خلفية شفافة ومقاس مربّع ~600×600) في `assets/images/`.
2. استخدم **نفس اسم الملف** الموجود في `require` الخاص بالمنتج.
3. أعد تشغيل الخادم مع مسح الذاكرة المؤقتة: `npx expo start -c`.

> الصور الحالية مجرّد صور بديلة ملوّنة حسب التصنيف. راجع `assets/images/README.md`.

---

## 🧾 آلية الطلب عبر واتساب

عند الضغط على **"إتمام الطلب عبر واتساب"** في السلة:

1. يُبنى نص رسالة يتضمّن: اسم المتجر، ثم كل منتج (`الاسم × الكمية = السعر الفرعي`)،
   ثم **المجموع الكلي**، ثم سطرَين فارغَين: `الاسم:` و`العنوان:` ليملأهما الزبون.
2. يُرمَّز النص عبر `encodeURIComponent` ويُبنى رابط:
   `https://wa.me/<WHATSAPP_NUMBER>?text=<MESSAGE>`
3. يُفتح الرابط عبر `Linking.openURL` (على الجوال) أو تبويب جديد (على الويب).

الكود في `lib/whatsapp.ts`.

---

## 🔄 إعادة توليد البيانات والصور (اختياري)

لإعادة توليد `data/products.ts` والصور البديلة من القائمة الأصلية:

```bash
npm run gen
```
الكود في `scripts/generate.js` (يمكنك تعديل القائمة فيه).

---

## 🧰 التقنيات المستخدمة

| التقنية | الغرض |
|---|---|
| Expo (SDK 52) | إطار العمل متعدد المنصّات |
| Expo Router | التنقّل المبني على الملفات |
| TypeScript | أمان الأنواع |
| NativeWind 4 (Tailwind) | التنسيق المتجاوب |
| expo-linear-gradient | التدرّجات اللونية |
| @expo/vector-icons | الأيقونات |

تم اختبار البناء بنجاح على الويب وأندرويد (`expo export`).
