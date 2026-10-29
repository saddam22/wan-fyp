import type { MetadataRoute } from "next";
import { fixtures } from "@edukhata/contracts";
import { SITE_URL } from "@/lib/site";

const STATIC = [
  "",
  "/assignments",
  "/practical-khata",
  "/mentors",
  "/how-it-works",
  "/pricing",
  "/blog",
  "/faq",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
  "/refund-policy",
  "/become-a-mentor",
  "/order/new",
  "/leaderboard",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...STATIC.map((p) => ({
      url: `${SITE_URL}${p}`,
      changeFrequency: "weekly" as const,
      priority: p === "" ? 1 : 0.7,
    })),
    ...fixtures.categories.map((c) => ({
      url: `${SITE_URL}/assignments/${c.slug}`,
      priority: 0.6,
    })),
    ...fixtures.mentors.map((m) => ({ url: `${SITE_URL}/mentors/${m.handle}`, priority: 0.5 })),
    ...fixtures.blogPosts.map((p) => ({
      url: `${SITE_URL}/blog/${p.slug}`,
      lastModified: p.at,
      priority: 0.5,
    })),
  ];
}
