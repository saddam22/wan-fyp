import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Socket.IO (chat) needs its trailing slash: /api/chat/socket.io/ must not be redirected.
  skipTrailingSlashRedirect: true,
  // The contracts package ships TypeScript sources.
  transpilePackages: ["@edukhata/contracts"],
  // Browsers talk only to this origin; /api/* is proxied to the EduKhata API (apps/api).
  async headers() {
    const https = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Calls need the camera and microphone on this origin only.
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()",
          },
          // Next.js needs inline scripts; this still blocks plugins, <base> hijacking and framing.
          {
            key: "Content-Security-Policy",
            value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
          },
          ...(https
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
            : []),
        ],
      },
    ];
  },
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
