/**
 * EduKhata notification types: one list shared by the API (registration with the WAN
 * social module's NotificationService, push text) and the web app (in-app text).
 * `data` holds only small, non-sensitive render values.
 */
import type { Lang } from "./format";

export interface NotificationTypeSpec {
  type: string;
  category: "account" | "family" | "referral" | "messages" | "orders";
  /** Security and access changes ignore opt-outs. */
  mandatory?: boolean;
  /** Repeated events with the same groupKey merge ("3 new messages"). */
  aggregatable?: boolean;
  channels: ("in_app" | "push" | "email")[];
  link: (p: Record<string, unknown>) => string;
  text: Record<
    Lang,
    (
      d: Record<string, string | number | boolean>,
      actorCount: number,
    ) => { title: string; body: string }
  >;
}

const s = (v: unknown) => String(v ?? "");

export const NOTIFICATION_TYPES: NotificationTypeSpec[] = [
  {
    type: "account.welcome",
    category: "account",
    channels: ["in_app"],
    link: (p) => s(p.home) || "/",
    text: {
      en: (d) => ({ title: "Welcome to EduKhata", body: `Your ${s(d.role)} dashboard is ready.` }),
      bn: (d) => ({ title: "এডুখাতায় স্বাগতম", body: `আপনার ${s(d.role)} ড্যাশবোর্ড প্রস্তুত।` }),
    },
  },
  {
    type: "account.roles_changed",
    category: "account",
    mandatory: true,
    channels: ["in_app", "push"],
    link: (p) => s(p.home) || "/",
    text: {
      en: (d) => ({
        title: "Your EduKhata roles changed",
        body: d.added ? `Added: ${s(d.added)}` : `Removed: ${s(d.removed)}`,
      }),
      bn: (d) => ({
        title: "আপনার এডুখাতা ভূমিকা বদলেছে",
        body: d.added ? `যোগ হয়েছে: ${s(d.added)}` : `বাদ গেছে: ${s(d.removed)}`,
      }),
    },
  },
  {
    type: "guardian.linked",
    category: "family",
    mandatory: true,
    channels: ["in_app", "push"],
    link: (p) => s(p.link) || "/",
    text: {
      en: (d) => ({
        title: "Guardian link added",
        body: `${s(d.guardian)} is now linked to ${s(d.student)}.`,
      }),
      bn: (d) => ({
        title: "অভিভাবক যুক্ত হয়েছেন",
        body: `${s(d.guardian)} এখন ${s(d.student)}-এর সাথে যুক্ত।`,
      }),
    },
  },
  {
    type: "guardian.unlinked",
    category: "family",
    mandatory: true,
    channels: ["in_app"],
    link: (p) => s(p.link) || "/",
    text: {
      en: (d) => ({
        title: "Guardian link removed",
        body: `${s(d.guardian)} is no longer linked to ${s(d.student)}.`,
      }),
      bn: (d) => ({
        title: "অভিভাবক সংযোগ বাতিল",
        body: `${s(d.guardian)} আর ${s(d.student)}-এর সাথে যুক্ত নেই।`,
      }),
    },
  },
  {
    type: "referral.joined",
    category: "referral",
    channels: ["in_app", "push"],
    link: (p) => s(p.link) || "/student/referrals",
    text: {
      en: (d) => ({
        title: "A friend joined with your code",
        body: `${s(d.friend)} signed up. You earn your reward after their first completed order.`,
      }),
      bn: (d) => ({
        title: "আপনার কোডে বন্ধু যোগ দিয়েছে",
        body: `${s(d.friend)} যোগ দিয়েছে। তাদের প্রথম অর্ডার সম্পন্ন হলে আপনি পুরস্কার পাবেন।`,
      }),
    },
  },
  {
    type: "chat.message",
    category: "messages",
    aggregatable: true,
    channels: ["in_app", "push"],
    link: (p) => `/messages?c=${encodeURIComponent(s(p.conversationId))}`,
    text: {
      en: (d, n) => ({
        title: n > 1 ? `${n} new messages` : `New message from ${s(d.sender)}`,
        body: s(d.preview) || "Open the conversation to read it.",
      }),
      bn: (d, n) => ({
        title: n > 1 ? `${n}টি নতুন বার্তা` : `${s(d.sender)}-এর নতুন বার্তা`,
        body: s(d.preview) || "পড়তে কথোপকথন খুলুন।",
      }),
    },
  },
  {
    type: "call.missed",
    category: "messages",
    channels: ["in_app", "push"],
    link: (p) =>
      p.conversationId ? `/messages?c=${encodeURIComponent(s(p.conversationId))}` : "/messages",
    text: {
      en: (d) => ({
        title: "Missed call",
        body: `${s(d.caller)} tried to call you (${s(d.media)}).`,
      }),
      bn: (d) => ({ title: "মিসড কল", body: `${s(d.caller)} আপনাকে কল করেছিলেন (${s(d.media)})।` }),
    },
  },
];

/** Order notifications: the API passes `link` (each recipient's own area) and code/title. */
const order = (
  type: string,
  en: (d: Record<string, string | number | boolean>) => string,
  bn: (d: Record<string, string | number | boolean>) => string,
  opts: Partial<Pick<NotificationTypeSpec, "mandatory" | "channels">> = {},
): NotificationTypeSpec => ({
  type,
  category: "orders",
  channels: opts.channels ?? ["in_app", "push"],
  ...(opts.mandatory ? { mandatory: true } : {}),
  link: (p) => s(p.link) || "/",
  text: {
    en: (d) => ({ title: en(d), body: `${s(d.code)} · ${s(d.title)}` }),
    bn: (d) => ({ title: bn(d), body: `${s(d.code)} · ${s(d.title)}` }),
  },
});

const ORDER_TYPES: NotificationTypeSpec[] = [
  order(
    "payment.submitted",
    (d) => `Payment to check: ${s(d.amount)}`,
    (d) => `যাচাই করার পেমেন্ট: ${s(d.amount)}`,
    { channels: ["in_app"] },
  ),
  order(
    "payment.approved",
    () => "Payment confirmed",
    () => "পেমেন্ট নিশ্চিত হয়েছে",
    { mandatory: true },
  ),
  order(
    "payment.rejected",
    (d) => `Payment not matched: ${s(d.note)}`,
    (d) => `পেমেন্ট মেলেনি: ${s(d.note)}`,
    { mandatory: true },
  ),
  order(
    "order.offer",
    () => "New order offer — accept before it expires",
    () => "নতুন অর্ডারের অফার — মেয়াদ শেষের আগে গ্রহণ করুন",
  ),
  order(
    "order.assigned",
    (d) => `${s(d.mentor)} is working on your order`,
    (d) => `${s(d.mentor)} আপনার অর্ডারে কাজ করছেন`,
  ),
  order(
    "order.delivered",
    () => "Your work is ready for review",
    () => "আপনার কাজ দেখার জন্য প্রস্তুত",
  ),
  order(
    "order.revision",
    (d) => `Revision ${s(d.n)} requested`,
    (d) => `রিভিশন ${s(d.n)} চাওয়া হয়েছে`,
  ),
  order(
    "order.approved",
    () => "The student approved your work",
    () => "শিক্ষার্থী আপনার কাজ অনুমোদন করেছেন",
  ),
  order(
    "order.deadline",
    (d) => `Due in ${s(d.hours)} hours`,
    (d) => `${s(d.hours)} ঘণ্টার মধ্যে জমা দিতে হবে`,
  ),
  order(
    "order.revision_due",
    () => "Revision needs payment",
    () => "রিভিশনের জন্য পেমেন্ট দরকার",
  ),
  order(
    "order.closed",
    () => "Order closed",
    () => "অর্ডার সম্পন্ন",
  ),
  order(
    "order.cancelled",
    () => "Order cancelled",
    () => "অর্ডার বাতিল হয়েছে",
  ),
  order(
    "order.reassigned",
    () => "Your order has a new mentor",
    () => "আপনার অর্ডারে নতুন মেন্টর",
  ),
  order(
    "order.unassigned",
    () => "You were removed from an order",
    () => "আপনাকে একটি অর্ডার থেকে সরানো হয়েছে",
    { mandatory: true },
  ),
  order(
    "order.needs_assignment",
    () => "No mentor accepted — assign one",
    () => "কোনো মেন্টর গ্রহণ করেননি — একজনকে দিন",
    { channels: ["in_app"] },
  ),
  order(
    "order.dispute",
    (d) => (d.resolved ? "Dispute resolved" : "Dispute opened"),
    (d) => (d.resolved ? "বিরোধের নিষ্পত্তি হয়েছে" : "বিরোধ খোলা হয়েছে"),
    { mandatory: true },
  ),
];

NOTIFICATION_TYPES.push(...ORDER_TYPES);

export function renderNotification(
  type: string,
  data: Record<string, string | number | boolean>,
  actorCount: number,
  lang: Lang = "en",
): { title: string; body: string } {
  const spec = NOTIFICATION_TYPES.find((t) => t.type === type);
  return spec ? spec.text[lang](data, actorCount) : { title: "EduKhata", body: "" };
}

/** A notification as the API returns it to the signed-in recipient. */
export interface NotificationDto {
  id: string;
  type: string;
  category: string;
  link: string;
  data: Record<string, string | number | boolean>;
  actorCount: number;
  createdAt: string;
  updatedAt: string;
  readAt: string | null;
  seenAt: string | null;
}
