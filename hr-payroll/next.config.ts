import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["exceljs", "@prisma/client", "bcryptjs"],
  // رفع ملف الإكسل في شاشة الاستيراد (الافتراضي 1MB)
  experimental: { serverActions: { bodySizeLimit: "20mb" } },
};

export default nextConfig;
