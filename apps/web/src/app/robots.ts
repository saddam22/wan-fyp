import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/student",
        "/mentor/",
        "/guardian",
        "/admin",
        "/accountant",
        "/support-desk",
        "/login",
        "/onboarding",
        "/access-request",
        "/search",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
