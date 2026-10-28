import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The contracts package ships TypeScript sources.
  transpilePackages: ["@edukhata/contracts"],
  // Browsers talk only to this origin; /api/* is proxied to the EduKhata API (apps/api).
  async rewrites() {
    const api = (process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4200").replace(/\/+$/, "");
    return [{ source: "/api/:path*", destination: `${api}/:path*` }];
  },
};

export default nextConfig;
