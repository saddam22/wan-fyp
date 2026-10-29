import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Socket.IO (chat) needs its trailing slash: /api/chat/socket.io/ must not be redirected.
  skipTrailingSlashRedirect: true,
  // The contracts package ships TypeScript sources.
  transpilePackages: ["@edukhata/contracts"],
  // Browsers talk only to this origin; /api/* is proxied to the EduKhata API (apps/api).
  async rewrites() {
    const api = (process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4200").replace(/\/+$/, "");
    return [
      // Keep Socket.IO's trailing slash (the generic rule below would drop it).
      { source: "/api/chat/socket.io/", destination: `${api}/chat/socket.io/` },
      { source: "/api/:path*", destination: `${api}/:path*` },
    ];
  },
};

export default nextConfig;
