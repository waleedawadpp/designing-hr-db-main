// ============================================================
// data/products.ts
// قائمة المنتجات. الأسعار غير متوفرة حالياً = 0 (راجع // TODO).
// الصورة عبر require ثابت وصريح (يتطلبه Metro bundler).
// ملف هذا الملف مُولَّد عبر scripts/generate.js لكن يمكن تعديله يدوياً.
// ============================================================

export type Category =
  | "TEA TIME"
  | "VIO MILK"
  | "SIWAR"
  | "SUPER"
  | "Serene"
  | "MECCA"
  | "Frovita"
  | "Juice"
  | "Other";

export type Product = {
  id: number;
  name: string;
  price: number;
  category: Category;
  image: any; // require(...) لمصدر الصورة المحلي
};

export const PRODUCTS: Product[] = [
  // TODO: أضف السعر
  {
    id: 3,
    name: "TEA TIME ICE TEA PINE APPLE 330ML",
    price: 0,
    category: "TEA TIME",
    image: require("../assets/images/tea-time-ice-tea-pine-apple-330ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 4,
    name: "TEA TIME ICE TEA WATERMELON 330ML",
    price: 0,
    category: "TEA TIME",
    image: require("../assets/images/tea-time-ice-tea-watermelon-330ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 5,
    name: "TEA TIME ICE TEA PEACH 330ML",
    price: 0,
    category: "TEA TIME",
    image: require("../assets/images/tea-time-ice-tea-peach-330ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 6,
    name: "TEA TIME ICE TEA PEACH ZERO SUGAR 330ML",
    price: 0,
    category: "TEA TIME",
    image: require("../assets/images/tea-time-ice-tea-peach-zero-sugar-330ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 7,
    name: "TEA TIME ICE TEA POMEGRANATE 330ML",
    price: 0,
    category: "TEA TIME",
    image: require("../assets/images/tea-time-ice-tea-pomegranate-330ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 8,
    name: "TEA TIME ICE TEA GRAPE 330ML",
    price: 0,
    category: "TEA TIME",
    image: require("../assets/images/tea-time-ice-tea-grape-330ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 9,
    name: "TEA TIME ICE TEA RED FRUITS 330ML",
    price: 0,
    category: "TEA TIME",
    image: require("../assets/images/tea-time-ice-tea-red-fruits-330ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 10,
    name: "TEA TIME ICE TEA RED FRUITS ZERO SUGAR 330ML",
    price: 0,
    category: "TEA TIME",
    image: require("../assets/images/tea-time-ice-tea-red-fruits-zero-sugar-330ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 11,
    name: "TEA TIME ICE TEA CHERRY 330ML",
    price: 0,
    category: "TEA TIME",
    image: require("../assets/images/tea-time-ice-tea-cherry-330ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 12,
    name: "TEA TIME ICE TEA LEMON MINT 330ML",
    price: 0,
    category: "TEA TIME",
    image: require("../assets/images/tea-time-ice-tea-lemon-mint-330ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 13,
    name: "TEA TIME ICE TEA MANGO 330ML",
    price: 0,
    category: "TEA TIME",
    image: require("../assets/images/tea-time-ice-tea-mango-330ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 14,
    name: "VIO MILK BISCUIT",
    price: 0,
    category: "VIO MILK",
    image: require("../assets/images/vio-milk-biscuit.png"),
  },
  // TODO: أضف السعر
  {
    id: 15,
    name: "VIO MILK MELON",
    price: 0,
    category: "VIO MILK",
    image: require("../assets/images/vio-milk-melon.png"),
  },
  // TODO: أضف السعر
  {
    id: 16,
    name: "VIO MILK ALMOND",
    price: 0,
    category: "VIO MILK",
    image: require("../assets/images/vio-milk-almond.png"),
  },
  // TODO: أضف السعر
  {
    id: 17,
    name: "VIO MILK CARDAMOM & GINGER",
    price: 0,
    category: "VIO MILK",
    image: require("../assets/images/vio-milk-cardamom-ginger.png"),
  },
  // TODO: أضف السعر
  {
    id: 18,
    name: "SIWAR UP 250ML",
    price: 0,
    category: "SIWAR",
    image: require("../assets/images/siwar-up-250ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 19,
    name: "SIWAR ORANGE 150ML",
    price: 0,
    category: "SIWAR",
    image: require("../assets/images/siwar-orange-150ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 20,
    name: "SIWAR ORANGE 250ML",
    price: 0,
    category: "SIWAR",
    image: require("../assets/images/siwar-orange-250ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 21,
    name: "SIWAR COLA 250ML",
    price: 0,
    category: "SIWAR",
    image: require("../assets/images/siwar-cola-250ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 22,
    name: "Super Watermelon 250ml",
    price: 0,
    category: "SUPER",
    image: require("../assets/images/super-watermelon-250ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 23,
    name: "Super Blueberry 250ml",
    price: 0,
    category: "SUPER",
    image: require("../assets/images/super-blueberry-250ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 24,
    name: "Super Black Night Flavour 250ml",
    price: 0,
    category: "SUPER",
    image: require("../assets/images/super-black-night-flavour-250ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 25,
    name: "Super Tutti Frutti 250ml",
    price: 0,
    category: "SUPER",
    image: require("../assets/images/super-tutti-frutti-250ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 26,
    name: "Super Pomegranate 250ml",
    price: 0,
    category: "SUPER",
    image: require("../assets/images/super-pomegranate-250ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 27,
    name: "Super Bubble Gum 250ml",
    price: 0,
    category: "SUPER",
    image: require("../assets/images/super-bubble-gum-250ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 28,
    name: "Super Grape 250ml",
    price: 0,
    category: "SUPER",
    image: require("../assets/images/super-grape-250ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 29,
    name: "Super Lime Flavor 250ml",
    price: 0,
    category: "SUPER",
    image: require("../assets/images/super-lime-flavor-250ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 30,
    name: "Super Mango & Peach 250ml",
    price: 0,
    category: "SUPER",
    image: require("../assets/images/super-mango-peach-250ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 31,
    name: "Super Mojito 250ml",
    price: 0,
    category: "SUPER",
    image: require("../assets/images/super-mojito-250ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 32,
    name: "Super Pina Colada 250ml",
    price: 0,
    category: "SUPER",
    image: require("../assets/images/super-pina-colada-250ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 33,
    name: "Super Triple Berry 250ml",
    price: 0,
    category: "SUPER",
    image: require("../assets/images/super-triple-berry-250ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 34,
    name: "Super Zero Tutti Frutti Sugar Free 250ml",
    price: 0,
    category: "SUPER",
    image: require("../assets/images/super-zero-tutti-frutti-sugar-free-250ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 35,
    name: "Super Zero Mojito Sugar Free 250ml",
    price: 0,
    category: "SUPER",
    image: require("../assets/images/super-zero-mojito-sugar-free-250ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 36,
    name: "Super Sour Blueberry 250ml",
    price: 0,
    category: "SUPER",
    image: require("../assets/images/super-sour-blueberry-250ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 37,
    name: "Super Sour Green Apple 250ml",
    price: 0,
    category: "SUPER",
    image: require("../assets/images/super-sour-green-apple-250ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 38,
    name: "Super Mix",
    price: 0,
    category: "SUPER",
    image: require("../assets/images/super-mix.png"),
  },
  // TODO: أضف السعر
  {
    id: 39,
    name: "Super Sparkling",
    price: 0,
    category: "SUPER",
    image: require("../assets/images/super-sparkling.png"),
  },
  // TODO: أضف السعر
  {
    id: 40,
    name: "Serene Pineapple 240ML",
    price: 0,
    category: "Serene",
    image: require("../assets/images/serene-pineapple-240ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 41,
    name: "Serene Peach 240ML",
    price: 0,
    category: "Serene",
    image: require("../assets/images/serene-peach-240ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 42,
    name: "Serene Mix Fruit 240ML",
    price: 0,
    category: "Serene",
    image: require("../assets/images/serene-mix-fruit-240ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 43,
    name: "Serene Mango 240ML",
    price: 0,
    category: "Serene",
    image: require("../assets/images/serene-mango-240ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 44,
    name: "Serene Orange 240ML",
    price: 0,
    category: "Serene",
    image: require("../assets/images/serene-orange-240ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 45,
    name: "Serene Strawberry & Banana 240ML",
    price: 0,
    category: "Serene",
    image: require("../assets/images/serene-strawberry-banana-240ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 46,
    name: "ICE CHAI KARAK MASALA FLAVOUR 250ml",
    price: 0,
    category: "Other",
    image: require("../assets/images/ice-chai-karak-masala-flavour-250ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 47,
    name: "ICE CHAI KARAK CARDAMOM FLAVOUR 250ml",
    price: 0,
    category: "Other",
    image: require("../assets/images/ice-chai-karak-cardamom-flavour-250ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 48,
    name: "Pineapple Juice",
    price: 0,
    category: "Juice",
    image: require("../assets/images/pineapple-juice.png"),
  },
  // TODO: أضف السعر
  {
    id: 49,
    name: "Orange Juice",
    price: 0,
    category: "Juice",
    image: require("../assets/images/orange-juice.png"),
  },
  // TODO: أضف السعر
  {
    id: 50,
    name: "Guava Juice",
    price: 0,
    category: "Juice",
    image: require("../assets/images/guava-juice.png"),
  },
  // TODO: أضف السعر
  {
    id: 51,
    name: "Cocktail Juice",
    price: 0,
    category: "Juice",
    image: require("../assets/images/cocktail-juice.png"),
  },
  // TODO: أضف السعر
  {
    id: 52,
    name: "Mango Juice",
    price: 0,
    category: "Juice",
    image: require("../assets/images/mango-juice.png"),
  },
  // TODO: أضف السعر
  {
    id: 53,
    name: "MR KING ORIGINAL",
    price: 0,
    category: "Other",
    image: require("../assets/images/mr-king-original.png"),
  },
  // TODO: أضف السعر
  {
    id: 54,
    name: "MR KING MOCHA",
    price: 0,
    category: "Other",
    image: require("../assets/images/mr-king-mocha.png"),
  },
  // TODO: أضف السعر
  {
    id: 55,
    name: "MEG SHARK 250ML",
    price: 0,
    category: "Other",
    image: require("../assets/images/meg-shark-250ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 56,
    name: "TEA TIME ICE TEA RASPBERRY",
    price: 0,
    category: "TEA TIME",
    image: require("../assets/images/tea-time-ice-tea-raspberry.png"),
  },
  // TODO: أضف السعر
  {
    id: 61,
    name: "Serene Guava 240ML",
    price: 0,
    category: "Serene",
    image: require("../assets/images/serene-guava-240ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 62,
    name: "MECCA COLA 250ML",
    price: 0,
    category: "MECCA",
    image: require("../assets/images/mecca-cola-250ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 63,
    name: "MECCA LEMON 250ML",
    price: 0,
    category: "MECCA",
    image: require("../assets/images/mecca-lemon-250ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 64,
    name: "MECCA COLA ZERO 250ML",
    price: 0,
    category: "MECCA",
    image: require("../assets/images/mecca-cola-zero-250ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 65,
    name: "MECCA ORANGE 250ML",
    price: 0,
    category: "MECCA",
    image: require("../assets/images/mecca-orange-250ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 66,
    name: "TEA TIME ICE TEA LEMON MINT Sparkling",
    price: 0,
    category: "TEA TIME",
    image: require("../assets/images/tea-time-ice-tea-lemon-mint-sparkling.png"),
  },
  // TODO: أضف السعر
  {
    id: 68,
    name: "Spicy Mojito 250ml",
    price: 0,
    category: "Other",
    image: require("../assets/images/spicy-mojito-250ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 69,
    name: "Spicy Malt 250ml",
    price: 0,
    category: "Other",
    image: require("../assets/images/spicy-malt-250ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 70,
    name: "Frovita Mango Juice 280ml",
    price: 0,
    category: "Frovita",
    image: require("../assets/images/frovita-mango-juice-280ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 71,
    name: "Frovita Passion Fruit Juice 280ml",
    price: 0,
    category: "Frovita",
    image: require("../assets/images/frovita-passion-fruit-juice-280ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 72,
    name: "Frovita Strawberry Juice 280ml",
    price: 0,
    category: "Frovita",
    image: require("../assets/images/frovita-strawberry-juice-280ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 73,
    name: "Frovita Kiwi Juice 280ml",
    price: 0,
    category: "Frovita",
    image: require("../assets/images/frovita-kiwi-juice-280ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 74,
    name: "TT ICE TEA GREEN APPLE 330ML",
    price: 0,
    category: "TEA TIME",
    image: require("../assets/images/tt-ice-tea-green-apple-330ml.png"),
  },
  // TODO: أضف السعر
  {
    id: 75,
    name: "TT ICE TEA ROSE 330ML",
    price: 0,
    category: "TEA TIME",
    image: require("../assets/images/tt-ice-tea-rose-330ml.png"),
  },
];

// قائمة التصنيفات بالترتيب المعروض في الشريط العلوي
export const CATEGORIES: Category[] = [
  "TEA TIME",
  "VIO MILK",
  "SIWAR",
  "SUPER",
  "Serene",
  "MECCA",
  "Frovita",
  "Juice",
  "Other",
];
