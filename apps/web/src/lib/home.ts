import "server-only";
import { apiFetch } from "./api";
import { authMode } from "./auth-mode";

export interface LiveHome {
  stats: {
    students: number;
    mentors: number;
    ordersCompleted: number;
    reviews: number;
    positivePct: number | null;
  };
  topMentors: {
    id: string;
    name: string;
    subjects: string[];
    verified: boolean;
    rating: number | null;
    reviewCount: number;
    points: number;
  }[];
  topStudents: { name: string; institution: string; classLevel: string; points: number }[];
  testimonials: { id: string; rating: number; text: string; name: string; institution: string }[];
  banners: {
    id: string;
    pre: string;
    main: string;
    post: string;
    ctaLabel: string | null;
    ctaHref: string | null;
    tone: "blue" | "violet" | "teal" | "rose" | "amber";
  }[];
  posts: { slug: string; title: string; tag: string; at: string; readMinutes: number }[];
}

/** Real homepage figures with the backend; null in the demo (sample figures are shown). */
export async function getHome(): Promise<LiveHome | null> {
  if (authMode() !== "wan") return null;
  const res = await apiFetch("/home").catch(() => null);
  return res?.ok ? ((await res.json()) as LiveHome) : null;
}
