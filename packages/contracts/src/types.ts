/**
 * Domain types shared by the web app and (from Phase 4) the API.
 * Money is always integer minor units (paisa for BDT) plus an ISO currency code.
 */

export type Currency = "BDT" | "USD";

export interface Money {
  amountMinor: number;
  currency: Currency;
}

/** Marketplace roles. Granted inside EduKhata — never implied by WAN sign-in. */
export type Role =
  "student" | "guardian" | "mentor" | "supporter" | "accountant" | "admin" | "super_admin";

export type Level = "ssc" | "hsc" | "university" | "vocational" | "school";

export interface Subject {
  id: string;
  name: string;
  nameBn: string;
  levels: Level[];
}

export interface Category {
  slug: string;
  name: string;
  nameBn: string;
  description: string;
  icon: string;
  tone: "blue" | "indigo" | "green" | "amber" | "violet" | "rose" | "teal";
  taskCount: number;
  kind: "assignment" | "practical" | "project";
}

export type WorkType =
  "digital" | "handwritten" | "practical_khata" | "biology_drawing" | "pencil_sketch" | "diagram";

/** Badges: "verified" is earned by review; "featured"/"pro" are paid and labelled as such. */
export type MentorBadge =
  "verified" | "top_rated" | "trusted" | "fast_delivery" | "popular" | "pro" | "featured";

export interface Mentor {
  id: string;
  handle: string;
  name: string;
  headline: string;
  subjects: string[];
  primarySubject: string;
  institution: string;
  education: string;
  bio: string;
  rating: number;
  reviewCount: number;
  completedOrders: number;
  onTimeRate: number;
  responseHours: number;
  startingPrice: Money;
  deliveryDays: number;
  badges: MentorBadge[];
  verified: boolean;
  available: boolean;
  activeOrders: number;
  capacity: number;
  country: string;
  languages: string[];
  hue: number;
  rankPoints: number;
  memberSince: string;
  hasVideoIntro: boolean;
}

export interface StudentSummary {
  id: string;
  name: string;
  institution: string;
  classLevel: string;
  points: number;
  hue: number;
}

export type OrderStatus =
  | "awaiting_payment"
  | "payment_review"
  | "matching"
  | "assigned"
  | "in_progress"
  | "delivered"
  | "revision_requested"
  | "approved"
  | "closed"
  | "cancelled"
  | "disputed"
  | "refunded";

export interface OrderFile {
  id: string;
  name: string;
  kind: "pdf" | "image" | "doc" | "zip";
  sizeKb: number;
  uploadedBy: "student" | "mentor";
  at: string;
  /** Preview files are watermarked; finals unlock after approval. */
  stage: "requirement" | "preview" | "final";
}

export interface OrderEvent {
  at: string;
  status: OrderStatus;
  note: string;
  actor: string;
}

export interface Revision {
  n: number;
  requestedAt: string;
  instructions: string;
  paid: boolean;
  resolvedAt?: string;
  /** Live API: fee of a paid revision and whether it is paid. */
  feeMinor?: number;
  paymentStatus?: "not_required" | "due" | "paid" | "cancelled";
}

export interface Order {
  id: string;
  code: string;
  title: string;
  categorySlug: string;
  subject: string;
  level: Level;
  workType: WorkType;
  pages: number;
  instructions: string;
  studentId: string;
  studentName: string;
  mentorId?: string;
  mentorName?: string;
  status: OrderStatus;
  price: Money;
  /** Coupon discount already taken off `price`. */
  discount?: Money;
  commissionRate: number;
  createdAt: string;
  deadline: string;
  deliveredAt?: string;
  freeRevisions: number;
  revisions: Revision[];
  files: OrderFile[];
  timeline: OrderEvent[];
  deliveryMethod: "digital" | "courier" | "pickup";
  conversationId?: string;
  /** Live API: the mentor's share (mentor and staff only). */
  payout?: Money;
  deliveryAddress?: string;
  needsManualAssignment?: boolean;
  dispute?: {
    id: string;
    status: string;
    reason: string;
    openedAt: string;
    resolvedAt?: string;
    resolutionNote?: string | null;
    refundMinor?: number;
  } | null;
}

export interface Offer {
  id: string;
  orderId: string;
  orderCode: string;
  title: string;
  subject: string;
  workType: WorkType;
  pages: number;
  payout: Money;
  deadline: string;
  expiresAt: string;
  matchScore: number;
}

export type PaymentStatus = "pending" | "submitted" | "approved" | "rejected" | "refunded";

export interface Payment {
  id: string;
  invoiceNo: string;
  orderId: string;
  orderCode: string;
  payerName: string;
  amount: Money;
  method: "bkash" | "nagad" | "rocket" | "bank";
  channel: "personal" | "agent" | "merchant" | "bank";
  sender?: string;
  trxId?: string;
  hasProof: boolean;
  status: PaymentStatus;
  createdAt: string;
  submittedAt?: string;
  decidedAt?: string;
  decidedBy?: string;
  note?: string;
}

export interface PaymentOption {
  key: string;
  method: Payment["method"];
  channel: Payment["channel"];
  name: string;
  number: string;
  instructions: string[];
}

export type PayoutStatus = "requested" | "approved" | "paid" | "rejected";

export interface Payout {
  id: string;
  mentorId: string;
  mentorName: string;
  amount: Money;
  method: "bkash" | "nagad" | "rocket" | "bank";
  account: string;
  accountName?: string;
  status: PayoutStatus;
  requestedAt: string;
  decidedAt?: string;
  reference?: string;
  /** Why it was rejected (shown to the mentor). */
  note?: string;
}

export interface LedgerEntry {
  id: string;
  txId: string;
  at: string;
  account: string;
  debitMinor: number;
  creditMinor: number;
  memo: string;
}

export interface Review {
  id: string;
  mentorId: string;
  studentName: string;
  rating: number;
  text: string;
  at: string;
  orderCode: string;
  status: "published" | "pending" | "hidden";
}

export type TicketStatus = "open" | "pending" | "escalated" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export interface TicketMessage {
  from: string;
  role: Role;
  at: string;
  text: string;
}

export interface Ticket {
  id: string;
  code: string;
  subject: string;
  category: "order" | "payment" | "account" | "mentor" | "technical" | "complaint";
  requester: string;
  requesterRole: Role;
  orderCode?: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignee?: string;
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
}

export interface Dispute {
  id: string;
  orderCode: string;
  openedBy: string;
  reason: string;
  amount: Money;
  status: "open" | "under_review" | "resolved_refund" | "resolved_release" | "resolved_partial";
  openedAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
  tone: "info" | "success" | "warning" | "danger";
  href?: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  body: string[];
  author: string;
  at: string;
  tag: string;
  readMinutes: number;
  hue: number;
}

export interface Testimonial {
  id: string;
  name: string;
  institution: string;
  text: string;
  rating: number;
  hue: number;
}

export interface Faq {
  q: string;
  a: string;
  group: "general" | "orders" | "payments" | "mentors";
}

export interface Service {
  id: string;
  mentorId: string;
  title: string;
  subject: string;
  workType: WorkType;
  pricePerPage: Money;
  discountPct: number;
  deliveryDays: number;
  active: boolean;
  orders: number;
}

export interface PortfolioItem {
  id: string;
  title: string;
  kind: "handwriting" | "practical_khata" | "drawing" | "diagram" | "digital";
  subject: string;
  hue: number;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  role: Role;
  action: string;
  target: string;
  ip: string;
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  status: "active" | "suspended" | "pending";
  joinedAt: string;
  country: string;
  lastActive: string;
}

export interface MentorApplication {
  id: string;
  name: string;
  subjects: string[];
  education: string;
  submittedAt: string;
  documents: {
    type: "nid" | "passport" | "certificate" | "transcript";
    status: "under_review" | "verified" | "rejected";
  }[];
  skillTestScore?: number;
  status: "pending" | "approved" | "rejected" | "needs_info";
}

export interface Coupon {
  code: string;
  description: string;
  discountPct: number;
  maxUses: number;
  used: number;
  expiresAt: string;
  active: boolean;
}

export interface ChildLink {
  studentId: string;
  name: string;
  institution: string;
  classLevel: string;
  activeOrders: number;
  completedOrders: number;
  spentMinor: number;
  permissions: { viewOrders: boolean; viewPayments: boolean; payOnBehalf: boolean };
}

export interface Conversation {
  id: string;
  title: string;
  orderCode?: string;
  peer: string;
  peerHue: number;
  lastMessage: string;
  at: string;
  unread: number;
  online: boolean;
  messages: { from: "me" | "peer"; text: string; at: string; file?: string }[];
}

export interface SkillTest {
  id: string;
  subject: string;
  questions: number;
  minutes: number;
  passMark: number;
  status: "available" | "passed" | "failed" | "locked";
  score?: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  earned: boolean;
  paid: boolean;
}

export interface ReferralSummary {
  code: string;
  link: string;
  invited: number;
  converted: number;
  earnedMinor: number;
  pendingMinor: number;
  rewardRule: string;
  history: {
    name: string;
    at: string;
    status: "joined" | "ordered" | "rewarded";
    rewardMinor: number;
  }[];
}
