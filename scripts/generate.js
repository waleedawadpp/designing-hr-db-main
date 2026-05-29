/* eslint-disable */
// Generator: builds data/products.ts and placeholder PNG images for every product.
// Run once with: node scripts/generate.js
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.join(__dirname, "..");
const IMG_DIR = path.join(ROOT, "assets", "images");
const DATA_DIR = path.join(ROOT, "data");

fs.mkdirSync(IMG_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

// --- Raw product list: [id, name] exactly as provided ---
const RAW = [
  [3, "TEA TIME ICE TEA PINE APPLE 330ML"],
  [4, "TEA TIME ICE TEA WATERMELON 330ML"],
  [5, "TEA TIME ICE TEA PEACH 330ML"],
  [6, "TEA TIME ICE TEA PEACH ZERO SUGAR 330ML"],
  [7, "TEA TIME ICE TEA POMEGRANATE 330ML"],
  [8, "TEA TIME ICE TEA GRAPE 330ML"],
  [9, "TEA TIME ICE TEA RED FRUITS 330ML"],
  [10, "TEA TIME ICE TEA RED FRUITS ZERO SUGAR 330ML"],
  [11, "TEA TIME ICE TEA CHERRY 330ML"],
  [12, "TEA TIME ICE TEA LEMON MINT 330ML"],
  [13, "TEA TIME ICE TEA MANGO 330ML"],
  [14, "VIO MILK BISCUIT"],
  [15, "VIO MILK MELON"],
  [16, "VIO MILK ALMOND"],
  [17, "VIO MILK CARDAMOM & GINGER"],
  [18, "SIWAR UP 250ML"],
  [19, "SIWAR ORANGE 150ML"],
  [20, "SIWAR ORANGE 250ML"],
  [21, "SIWAR COLA 250ML"],
  [22, "Super Watermelon 250ml"],
  [23, "Super Blueberry 250ml"],
  [24, "Super Black Night Flavour 250ml"],
  [25, "Super Tutti Frutti 250ml"],
  [26, "Super Pomegranate 250ml"],
  [27, "Super Bubble Gum 250ml"],
  [28, "Super Grape 250ml"],
  [29, "Super Lime Flavor 250ml"],
  [30, "Super Mango & Peach 250ml"],
  [31, "Super Mojito 250ml"],
  [32, "Super Pina Colada 250ml"],
  [33, "Super Triple Berry 250ml"],
  [34, "Super Zero Tutti Frutti Sugar Free 250ml"],
  [35, "Super Zero Mojito Sugar Free 250ml"],
  [36, "Super Sour Blueberry 250ml"],
  [37, "Super Sour Green Apple 250ml"],
  [38, "Super Mix"],
  [39, "Super Sparkling"],
  [40, "Serene Pineapple 240ML"],
  [41, "Serene Peach 240ML"],
  [42, "Serene Mix Fruit 240ML"],
  [43, "Serene Mango 240ML"],
  [44, "Serene Orange 240ML"],
  [45, "Serene Strawberry & Banana 240ML"],
  [46, "ICE CHAI KARAK MASALA FLAVOUR 250ml"],
  [47, "ICE CHAI KARAK CARDAMOM FLAVOUR 250ml"],
  [48, "Pineapple Juice"],
  [49, "Orange Juice"],
  [50, "Guava Juice"],
  [51, "Cocktail Juice"],
  [52, "Mango Juice"],
  [53, "MR KING ORIGINAL"],
  [54, "MR KING MOCHA"],
  [55, "MEG SHARK 250ML"],
  [56, "TEA TIME ICE TEA RASPBERRY"],
  [61, "Serene Guava 240ML"],
  [62, "MECCA COLA 250ML"],
  [63, "MECCA LEMON 250ML"],
  [64, "MECCA COLA ZERO 250ML"],
  [65, "MECCA ORANGE 250ML"],
  [66, "TEA TIME ICE TEA LEMON MINT Sparkling"],
  [68, "Spicy Mojito 250ml"],
  [69, "Spicy Malt 250ml"],
  [70, "Frovita Mango Juice 280ml"],
  [71, "Frovita Passion Fruit Juice 280ml"],
  [72, "Frovita Strawberry Juice 280ml"],
  [73, "Frovita Kiwi Juice 280ml"],
  [74, "TT ICE TEA GREEN APPLE 330ML"],
  [75, "TT ICE TEA ROSE 330ML"],
];

// --- Category detection by name prefix/content ---
function categorize(name) {
  const u = name.toUpperCase();
  if (u.startsWith("TEA TIME") || u.startsWith("TT ICE TEA")) return "TEA TIME";
  if (u.startsWith("VIO MILK")) return "VIO MILK";
  if (u.startsWith("SIWAR")) return "SIWAR";
  if (u.startsWith("SUPER")) return "SUPER";
  if (u.startsWith("SERENE")) return "Serene";
  if (u.startsWith("MECCA")) return "MECCA";
  if (u.startsWith("FROVITA")) return "Frovita";
  if (u.endsWith("JUICE")) return "Juice";
  return "Other";
}

// --- Slug from name: lowercase, non-alphanumerics -> single dash ---
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// --- Minimal PNG encoder (solid color, with a soft diagonal tint) ---
function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makePng(size, rgb) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // filter byte
    for (let x = 0; x < size; x++) {
      // soft diagonal gradient for a nicer placeholder
      const t = (x + y) / (2 * size);
      raw[p++] = Math.min(255, Math.round(rgb[0] * (0.78 + 0.22 * t)));
      raw[p++] = Math.min(255, Math.round(rgb[1] * (0.78 + 0.22 * t)));
      raw[p++] = Math.min(255, Math.round(rgb[2] * (0.78 + 0.22 * t)));
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Per-category placeholder color (pleasant pastel-ish tones)
const CAT_COLOR = {
  "TEA TIME": [245, 158, 11],
  "VIO MILK": [236, 201, 168],
  SIWAR: [59, 130, 246],
  SUPER: [168, 85, 247],
  Serene: [16, 185, 129],
  MECCA: [239, 68, 68],
  Frovita: [244, 114, 182],
  Juice: [251, 146, 60],
  Other: [124, 58, 237],
};

// --- Build products + images ---
const seen = new Set();
const products = RAW.map(([id, name]) => {
  const category = categorize(name);
  let slug = slugify(name);
  // guarantee unique filenames
  let unique = slug;
  let i = 2;
  while (seen.has(unique)) unique = `${slug}-${i++}`;
  seen.add(unique);
  const file = `${unique}.png`;
  // write placeholder image
  fs.writeFileSync(path.join(IMG_DIR, file), makePng(160, CAT_COLOR[category]));
  return { id, name, category, file };
});

// --- Emit data/products.ts ---
const lines = [];
lines.push("// ============================================================");
lines.push("// data/products.ts");
lines.push("// قائمة المنتجات. الأسعار غير متوفرة حالياً = 0 (راجع // TODO).");
lines.push("// الصورة عبر require ثابت وصريح (يتطلبه Metro bundler).");
lines.push("// ملف هذا الملف مُولَّد عبر scripts/generate.js لكن يمكن تعديله يدوياً.");
lines.push("// ============================================================");
lines.push("");
lines.push("export type Category =");
lines.push('  | "TEA TIME"');
lines.push('  | "VIO MILK"');
lines.push('  | "SIWAR"');
lines.push('  | "SUPER"');
lines.push('  | "Serene"');
lines.push('  | "MECCA"');
lines.push('  | "Frovita"');
lines.push('  | "Juice"');
lines.push('  | "Other";');
lines.push("");
lines.push("export type Product = {");
lines.push("  id: number;");
lines.push("  name: string;");
lines.push("  price: number;");
lines.push("  category: Category;");
lines.push("  image: any; // require(...) لمصدر الصورة المحلي");
lines.push("};");
lines.push("");
lines.push("export const PRODUCTS: Product[] = [");
for (const p of products) {
  lines.push("  // TODO: أضف السعر");
  lines.push("  {");
  lines.push(`    id: ${p.id},`);
  lines.push(`    name: ${JSON.stringify(p.name)},`);
  lines.push(`    price: 0,`);
  lines.push(`    category: ${JSON.stringify(p.category)},`);
  lines.push(`    image: require("../assets/images/${p.file}"),`);
  lines.push("  },");
}
lines.push("];");
lines.push("");
lines.push("// قائمة التصنيفات بالترتيب المعروض في الشريط العلوي");
lines.push("export const CATEGORIES: Category[] = [");
const order = ["TEA TIME", "VIO MILK", "SIWAR", "SUPER", "Serene", "MECCA", "Frovita", "Juice", "Other"];
const present = order.filter((c) => products.some((p) => p.category === c));
for (const c of present) lines.push(`  ${JSON.stringify(c)},`);
lines.push("];");
lines.push("");

fs.writeFileSync(path.join(DATA_DIR, "products.ts"), lines.join("\n"));

console.log(`Generated ${products.length} products and ${seen.size} images.`);
console.log("Categories:", present.join(", "));
