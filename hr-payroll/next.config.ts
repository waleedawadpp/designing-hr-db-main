import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["exceljs", "@prisma/client", "bcryptjs"],
};

export default nextConfig;
