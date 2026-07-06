/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Allow remote product images from any host (tighten in production).
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
