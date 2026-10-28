/**
 * The data interface the web app reads through. Phase 1 ships only `mockApi`
 * (demo fixtures, read-only). Phase 2+ adds an HTTP adapter with the same shape.
 */
import * as fx from "./fixtures";
import type { Mentor, Order, OrderStatus, Payment, Ticket } from "./types";

export interface MentorQuery {
  subject?: string;
  q?: string;
  sort?: "rating" | "price" | "orders" | "delivery";
  verifiedOnly?: boolean;
  availableOnly?: boolean;
}

export const ORDER_GROUPS: Record<
  "all" | "pending" | "processing" | "completed" | "cancelled",
  OrderStatus[] | null
> = {
  all: null,
  pending: ["awaiting_payment", "payment_review", "matching"],
  processing: ["assigned", "in_progress", "delivered", "revision_requested", "disputed"],
  completed: ["approved", "closed"],
  cancelled: ["cancelled", "refunded"],
};

export function searchMentors(list: Mentor[], query: MentorQuery): Mentor[] {
  const q = query.q?.trim().toLowerCase();
  const out = list.filter(
    (m) =>
      (!query.subject || query.subject === "all" || m.subjects.includes(query.subject)) &&
      (!query.verifiedOnly || m.verified) &&
      (!query.availableOnly || m.available) &&
      (!q ||
        `${m.name} ${m.headline} ${m.subjects.join(" ")} ${m.institution}`
          .toLowerCase()
          .includes(q)),
  );
  const sort = query.sort ?? "rating";
  // Organic ranking only — paid "featured" status never changes the sort order.
  return out.sort((a, b) =>
    sort === "price"
      ? a.startingPrice.amountMinor - b.startingPrice.amountMinor
      : sort === "orders"
        ? b.completedOrders - a.completedOrders
        : sort === "delivery"
          ? a.deliveryDays - b.deliveryDays
          : b.rating - a.rating || b.reviewCount - a.reviewCount,
  );
}

export const mockApi = {
  mentors: (query: MentorQuery = {}) => searchMentors([...fx.mentors], query),
  mentor: (handle: string): Mentor | undefined =>
    fx.mentors.find((m) => m.handle === handle || m.id === handle),
  topMentors: (n = 5) => [...fx.mentors].sort((a, b) => b.rankPoints - a.rankPoints).slice(0, n),
  orders: (group: keyof typeof ORDER_GROUPS = "all", studentId?: string): Order[] => {
    const statuses = ORDER_GROUPS[group];
    return fx.orders.filter(
      (o) =>
        (!studentId || o.studentId === studentId) && (!statuses || statuses.includes(o.status)),
    );
  },
  order: (id: string): Order | undefined => fx.orders.find((o) => o.id === id || o.code === id),
  mentorOrders: (mentorId: string) => fx.orders.filter((o) => o.mentorId === mentorId),
  payment: (id: string): Payment | undefined => fx.payments.find((p) => p.id === id),
  paymentsFor: (payerName: string) => fx.payments.filter((p) => p.payerName === payerName),
  ticket: (id: string): Ticket | undefined => fx.tickets.find((t) => t.id === id || t.code === id),
  category: (slug: string) => fx.categories.find((c) => c.slug === slug),
  subject: (id: string) => fx.subjects.find((s) => s.id === id),
  post: (slug: string) => fx.blogPosts.find((p) => p.slug === slug),
};
