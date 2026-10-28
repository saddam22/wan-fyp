import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The contracts package ships TypeScript sources.
  transpilePackages: ["@edukhata/contracts"],
};

export default nextConfig;
