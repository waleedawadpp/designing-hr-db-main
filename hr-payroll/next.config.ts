import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["exceljs", "@prisma/client", "bcryptjs"],
  // Node 22 يحمّل require.mjs من generator-function و async-function (اعتماديات غير مباشرة لـ exceljs) بشرط "module-sync"،
  // ومتتبّع الملفات لا ينسخه في مخرجات standalone (Hostinger) فيفشل تصدير Excel. نضمّنه صراحةً.
  outputFileTracingIncludes: { "/**/*": ["./node_modules/generator-function/require.mjs", "./node_modules/async-function/require.mjs"] },
  // رفع ملف الإكسل في شاشة الاستيراد (الافتراضي 1MB)
  experimental: { serverActions: { bodySizeLimit: "20mb" } },
};

export default nextConfig;
