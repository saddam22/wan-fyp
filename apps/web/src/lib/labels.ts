import type {
  Level,
  MentorBadge,
  OrderStatus,
  PaymentStatus,
  PayoutStatus,
  TicketPriority,
  TicketStatus,
  WorkType,
} from "@edukhata/contracts";
import { fixtures } from "@edukhata/contracts";

export type Tone = "gray" | "blue" | "green" | "amber" | "red" | "violet" | "teal";

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  awaiting_payment: { label: "Awaiting payment", tone: "amber" },
  payment_review: { label: "Payment review", tone: "amber" },
  matching: { label: "Finding mentor", tone: "violet" },
  assigned: { label: "Assigned", tone: "blue" },
  in_progress: { label: "In progress", tone: "blue" },
  delivered: { label: "Delivered", tone: "teal" },
  revision_requested: { label: "Revision requested", tone: "amber" },
  approved: { label: "Approved", tone: "green" },
  closed: { label: "Completed", tone: "green" },
  cancelled: { label: "Cancelled", tone: "gray" },
  disputed: { label: "Disputed", tone: "red" },
  refunded: { label: "Refunded", tone: "gray" },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  pending: { label: "Not paid yet", tone: "amber" },
  submitted: { label: "Awaiting verification", tone: "violet" },
  approved: { label: "Approved", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
  refunded: { label: "Refunded", tone: "gray" },
};

export const PAYOUT_STATUS: Record<PayoutStatus, { label: string; tone: Tone }> = {
  requested: { label: "Requested", tone: "amber" },
  approved: { label: "Approved", tone: "blue" },
  paid: { label: "Paid", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
};

export const TICKET_STATUS: Record<TicketStatus, { label: string; tone: Tone }> = {
  open: { label: "Open", tone: "blue" },
  pending: { label: "Pending", tone: "amber" },
  escalated: { label: "Escalated", tone: "red" },
  resolved: { label: "Resolved", tone: "green" },
  closed: { label: "Closed", tone: "gray" },
};

export const PRIORITY: Record<TicketPriority, { label: string; tone: Tone }> = {
  low: { label: "Low", tone: "gray" },
  normal: { label: "Normal", tone: "blue" },
  high: { label: "High", tone: "amber" },
  urgent: { label: "Urgent", tone: "red" },
};

export const WORK_TYPE: Record<WorkType, string> = {
  digital: "Digital (typed)",
  handwritten: "Handwritten",
  practical_khata: "Practical khata",
  biology_drawing: "Biology drawing",
  pencil_sketch: "Pencil sketch",
  diagram: "Diagram / illustration",
};

export const LEVEL: Record<Level, string> = {
  school: "School",
  ssc: "SSC",
  hsc: "HSC",
  university: "University",
  vocational: "Vocational",
};

export const BADGE: Record<MentorBadge, { label: string; tone: Tone; paid: boolean }> = {
  verified: { label: "Verified", tone: "green", paid: false },
  top_rated: { label: "Top Rated", tone: "blue", paid: false },
  trusted: { label: "Trusted", tone: "teal", paid: false },
  fast_delivery: { label: "Fast Delivery", tone: "amber", paid: false },
  popular: { label: "Popular", tone: "red", paid: false },
  pro: { label: "Pro", tone: "violet", paid: true },
  featured: { label: "Featured", tone: "amber", paid: true },
};

export function subjectName(id: string, lang: "en" | "bn" = "en"): string {
  const s = fixtures.subjects.find((x) => x.id === id);
  return s ? (lang === "bn" ? s.nameBn : s.name) : id;
}
