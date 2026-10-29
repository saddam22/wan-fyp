import "server-only";
import { fixtures, mockApi, type BlogPost } from "@edukhata/contracts";
import { apiFetch } from "./api";
import { authMode } from "./auth-mode";

interface LivePost {
  slug: string;
  title: string;
  excerpt: string;
  body?: string;
  category: string;
  authorName: string;
  publishedAt: string | null;
  readMinutes: number;
}

const hue = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const toPost = (p: LivePost): BlogPost & { text?: string } => ({
  slug: p.slug,
  title: p.title,
  excerpt: p.excerpt,
  body: [],
  author: p.authorName,
  at: p.publishedAt ?? new Date().toISOString(),
  tag: p.category.replace(/-/g, " "),
  readMinutes: p.readMinutes,
  hue: hue(p.slug),
  ...(p.body !== undefined ? { text: p.body } : {}),
});

/** Published posts: from the API with the real backend, sample posts in the demo. */
export async function getPosts(): Promise<BlogPost[]> {
  if (authMode() !== "wan") return fixtures.blogPosts;
  const res = await apiFetch("/content/posts");
  return res.ok ? ((await res.json()) as LivePost[]).map(toPost) : [];
}

/** One post; live posts carry `text` (rendered as plain text, never HTML). */
export async function getPost(slug: string): Promise<(BlogPost & { text?: string }) | null> {
  if (authMode() !== "wan") return mockApi.post(slug) ?? null;
  const res = await apiFetch(`/content/posts/${encodeURIComponent(slug)}`);
  return res.ok ? toPost((await res.json()) as LivePost) : null;
}
