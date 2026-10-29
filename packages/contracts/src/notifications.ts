/**
 * EduKhata notification types: one list shared by the API (registration with the WAN
 * social module's NotificationService, push text) and the web app (in-app text).
 * `data` holds only small, non-sensitive render values.
 */
import type { Lang } from "./format";

export interface NotificationTypeSpec {
  type: string;
  category: "account" | "family" | "referral" | "messages";
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
    link: () => "/student/referrals",
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
    link: () => "/messages",
    text: {
      en: (d) => ({
        title: "Missed call",
        body: `${s(d.caller)} tried to call you (${s(d.media)}).`,
      }),
      bn: (d) => ({ title: "মিসড কল", body: `${s(d.caller)} আপনাকে কল করেছিলেন (${s(d.media)})।` }),
    },
  },
];

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
