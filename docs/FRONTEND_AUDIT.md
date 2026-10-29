# Frontend Audit — Mockup Review & Page Inventory

## Mockups received (2026-10-28)

| #   | Image                                                                                                   | What it shows                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1   | Composite: EduKhata homepage (left) + 6 dashboard thumbnails (right)                                    | Homepage v1; Student, Mentor, Admin, Accountant, Supporter dashboards; Live Chat & Video Session        |
| 2   | EduKhata homepage v2 (desktop)                                                                          | Same header/sidebars, new hero ("Your Complete Assignment & Practical Solution Platform"), shorter page |
| 3   | **WAN FYP** — "Final Year Project Portal", Project Overview dashboard + "Submit Project Revision" modal | A different product (matches the empty `wan-fyp` repo). **Out of EduKhata scope** (owner decision Q2)   |

**Resolution limit:** the images are phone screenshots ~720 px wide. Headings and layout are clear; most body text, table columns and dashboard details are unreadable. Dashboards are only legible at thumbnail level. Please send the HD originals (Q12). Where text is unreadable, labels will come from the spec, and each such guess is listed below.

## Homepage — structure read from mockups

**Header (row 1):** logo "EduKhata" + tagline "Assignment • Practical • Learning • Global"; search "Search assignments, subjects, mentors, or anything…" + "All Categories" select + search button; country/currency "BD (BDT)"; cart icon; bell with badge; Login; Register (blue).
**Header (row 2):** Home · Assignments ▾ · Practical Khata · Mentors ▾ · Live Classes ▾ · Exams ▾ · Order Now (v2) · How It Works · Pricing · Blog · Contact; right: **Become a Mentor** (green), **Post Assignment** (red).
**Left sidebar:** Top Students (rank 1–5, avatar, name, points, "View All"); Referral Program card (code `EKHATA2026`, copy, "Invite Now"); Platform Stats (students, mentors, orders, positive reviews).
**Hero:** v1 "Get Expert Help for Your Assignments & Practical Khata — from School, University, Local & Global" with search; v2 carousel with arrows, "Your Complete Assignment & Practical Solution Platform", chips (Trusted Mentors, Secure Payment, On-Time Delivery, 24/7 Support), search + subject select.
**Feature strip (v2):** 300+ Subjects (SSC to University) · Online & Handwritten · Verified Mentors · Fast Delivery · For Bangladesh & Worldwide.
**Popular Assignment Categories:** SSC, HSC, University, Practical Khata (Handwritten), Project & Report, ITI/Vocational; "View All Categories".
**Featured Mentors:** tabs All · Biology · Math · ICT · English · Physics · Chemistry · Business · Others; cards with video-intro thumbnail, ribbon (TOP RATED, TRUSTED, POPULAR, PRO, VERIFIED, FAST DELIVERY), name + verified tick, subject, ★ rating (orders), price ৳, delivery time, **Order Now**; promo card "Get 20% Discount on your first order — WELCOME20".
**Right sidebar:** Top Mentors (rank, rating); Why Choose EduKhata? (Verified Mentors & Students, Secure Payment & Money Hold, Revision System (2–3 times), Live Chat & Video with Recording, Skill Test & Certification, Profile Boost & Trusted Badge, Global Access); Need Help? card.
**v1 only:** How It Works (Search & Choose → Place Order → Mentor Works → Review & Approve → Payment Release → Leave a Review), Latest Assignments row, Student Testimonials, Latest Blog & Tips.
**Stats band (navy):** assignments completed, verified mentors, happy students, positive reviews, 24/7 support, 10+ countries.
**Footer (navy):** logo + about, Quick Links, Categories, Support, Stay Connected (Facebook, YouTube, LinkedIn, Instagram, TikTok, X), newsletter, Google Play / App Store badges, copyright, "Bangladesh | English | BDT ৳".

## Design tokens (initial, from mockups)

| Token       | Value (approx.)                         | Use                                                   |
| ----------- | --------------------------------------- | ----------------------------------------------------- |
| `--brand`   | #1D4ED8 / #2563EB                       | primary buttons, links, active nav, student dashboard |
| `--success` | #16A34A                                 | Become a Mentor, approve, accountant dashboard accent |
| `--danger`  | #E11D48                                 | Post Assignment, reject, admin dashboard accent       |
| `--mentor`  | #6D28D9                                 | mentor dashboard accent                               |
| `--support` | #F97316                                 | supporter dashboard accent, badges                    |
| `--navy`    | #0B1B3F                                 | stats band, footer                                    |
| `--surface` | #FFFFFF on #F5F7FB page                 | cards                                                 |
| radius      | 10–12 px cards, 8 px inputs, full pills |                                                       |
| type        | Inter (Latin) + Hind Siliguri (Bengali) | as in Hub/ICTSpark                                    |

Each role dashboard keeps the same shell (left sidebar, top bar, KPI cards) with its own accent colour — visible in the thumbnails.

## Items in the mockup that conflict with verified capabilities

| Mockup element                                   | Problem                                  | Proposal                                                   |
| ------------------------------------------------ | ---------------------------------------- | ---------------------------------------------------------- |
| Hard-coded stats (50,000+ students, 98%…)        | Would be false claims at launch          | Compute from DB; hide a stat below a threshold             |
| "Live Chat & Video **with Recording**"           | Calling module has no recording          | Show "Live Chat & Video" until recording is approved (Q11) |
| "Secure Payment & Money Hold", "Payment Release" | Holding funds — legal check (Q5)         | Keep wording only after approval                           |
| "10+ Countries"                                  | Launch is Bangladesh only                | "Bangladesh — expanding"                                   |
| Live Classes ▾, Exams ▾ nav                      | Not in the 18 modules; ICTSpark has them | Q3: link to ICTSpark, or remove                            |
| Cart icon                                        | Orders are custom, one at a time         | Use as "My Orders / drafts" or remove (Q13)                |
| App store badges                                 | No mobile app exists                     | Hide until apps exist                                      |

## Route inventory (planned for Phase 1)

Public: `/`, `/assignments`, `/assignments/[category]`, `/practical-khata`, `/mentors`, `/mentors/[handle]`, `/how-it-works`, `/pricing`, `/blog`, `/blog/[slug]`, `/faq`, `/about`, `/contact`, `/privacy`, `/terms`, `/refund-policy`, `/become-a-mentor`, `/order/new`, `/search`, `/login` (→ WAN), `/access-request`, `/onboarding`, `/403`, `/404`, `sitemap.xml`, `robots.txt`.

Student `/student/…`: overview, orders, orders/[id] (timeline, countdown, files, preview, approve, revision, dispute, chat), new-order, payments, invoices, favorites, referrals, notifications, support, messages, profile.
Mentor `/mentor/…`: overview, offers, orders, orders/[id] (deliver, revisions), services, portfolio, earnings, payouts, reviews, verification, skill-tests, badges, profile (+ QR card), calendar.
Guardian `/guardian/…`: overview, children (link via code), orders, payments, notifications, privacy.
Admin `/admin/…`: overview, users, mentors (applications, verification queue), students, staff, roles, subjects/classes/boards/categories, orders (+ manual assign), moderation, payments, payouts, refunds, disputes, coupons, referrals, ads & placements, boosts/subscriptions, banners, pages (CMS), blog, reviews, messages, notifications, rewards, settings, audit, security.
Accountant `/accountant/…`: overview, payment-verification, earnings, payouts, ledger, commission, refunds, reports (daily/monthly), invoices/export, audit.
Supporter `/support-desk/…`: overview, tickets, tickets/[id], complaints, order lookup (read-only), payment lookup (read-only), escalations, history.
Shared: messages (chat module UI), call overlay, notifications drawer, settings (language, notification preferences).

States for every data view: loading skeleton, empty, error (retry), success toast, permission denied.

Phase 1 uses **typed mock adapters** behind the same interfaces the real API will implement; every page using mock data shows a dev-only "Demo data" banner.

---

# Phase 1 — Frontend delivered (2026-10-28) · waiting for owner review

**Everything below runs on demo data. No backend, database, login, payment, chat or file storage is connected.** Every page shows a yellow "Demo preview" banner, and every action that would change data shows a "Demo only — not saved" message.

## How to review

```bash
pnpm install
pnpm --filter @edukhata/web build && pnpm --filter @edukhata/web start   # http://localhost:3200
```

Sign in on `/login` → **Demo sign-in** and pick a role (Student, Mentor, Guardian, Accountant, Supporter, Admin, Super Admin, or Student + Guardian). The "Continue with WAN ID" button is intentionally inactive until Phase 2.

Screenshots: `docs/screenshots/` (desktop 1440 px, mobile 390 px, one Bengali).

## Stack (as proposed in ARCHITECTURE.md)

pnpm monorepo · `apps/web` Next.js 16.4.2 (App Router, Turbopack) · React 19.2 · Tailwind CSS 4.3 · lucide-react · `packages/contracts` (shared types, money/date helpers, access rules, demo fixtures, mock adapter). `apps/api` is not created yet (Phase 2+).

## Pages (111)

| Area                     | Pages                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Public (20)              | `/`, `/assignments`, `/assignments/[category]`, `/practical-khata`, `/mentors`, `/mentors/[handle]`, `/order/new`, `/how-it-works`, `/pricing`, `/blog`, `/blog/[slug]`, `/faq`, `/about`, `/contact`, `/privacy`, `/terms`, `/refund-policy`, `/become-a-mentor`, `/search`, `/leaderboard` + `sitemap.xml`, `robots.txt`, 404                                                            |
| Sign-in (4)              | `/login` (WAN ID button + demo sign-in), `/access-request`, `/onboarding` (profile gate), `/forbidden`                                                                                                                                                                                                                                                                                     |
| Student (13)             | overview, new-order, orders, orders/[id], messages, favorites, payments, payments/[id]/pay, invoices, referrals, notifications, support, profile (incl. guardian link code)                                                                                                                                                                                                                |
| Mentor (17)              | overview (availability toggle), offers (timed accept/decline), orders, orders/[id] (deliver/revise), messages, calendar & sessions, services & pricing, portfolio, profile (+ QR card), verification, skill tests, badges & ranking, promote (boosts/subscriptions), earnings, payouts, reviews, notifications                                                                             |
| Guardian (8)             | overview, children (link/unlink), orders, orders/[id], payments, payments/[id]/pay, notifications, privacy & permissions                                                                                                                                                                                                                                                                   |
| Admin & Super Admin (29) | overview, orders, orders/[id] (assign/reassign/cancel), disputes, moderation, users, mentor applications, verification queue, students, staff\*, roles & permissions\*, payments, payouts, refunds, coupons, referrals, boosts, catalog, banners, pages (CMS), blog, reviews, advertising, website messages, notifications, rewards, settings\*, audit\*, security\* (\* super admin only) |
| Accountant (10)          | overview, payment verification (maker-checker ≥ ৳3,000), mentor earnings, payout requests, refunds, ledger (balanced check), commission, reports, invoices & export, audit history                                                                                                                                                                                                         |
| Supporter (10)           | overview, tickets, tickets/[id] (reply, internal note, priority, status, escalate), complaints, escalations, live chat, order lookup + detail (read-only), payment lookup, resolution history                                                                                                                                                                                              |

## Reusable components

`components/ui` (Button, Badge, Card, Avatar, Stars, StatCard, PageHeader, Field, Progress, EmptyState, Skeleton, KeyValue; client: Toast, Modal, Countdown, Tabs, DataTable with search/filter/sort/pagination/mobile cards, CopyButton) · `components/public` (Header with dropdowns + mobile drawer + language switch, Footer, Hero carousel, MentorCard, FeaturedMentors, homepage sections, AdSlot placeholder) · `components/dash` (Shell with per-role accent colour, OrdersTable, OrderDetail, ChatView, NotificationsList, PaymentsTable, ManualPayment, finance queues, admin managers, Charts) · `components/order/OrderWizard`.

Design tokens are in `apps/web/src/app/globals.css` (`@theme`); each dashboard sets its accent via `data-accent`. Chart colours were checked with the dataviz palette validator (all checks pass); charts have hover tooltips and a table view.

## States covered

Loading (Suspense skeletons), empty (EmptyState in every table/list), validation errors (all forms), success (toasts), permission denied (`Forbidden` for wrong role; super-admin-only pages), not found (404 for missing or other people's orders), sign-in redirect for anonymous users.

## What is mocked or not functional (honest list)

| Item            | State                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Sign-in         | Demo role cookie only. WAN ID (OIDC) is Phase 2 and needs hub changes H1–H2                                             |
| All data        | Fixtures in `packages/contracts/src/fixtures.ts` (fictional people and money)                                           |
| Saving anything | Local state only; refresh resets                                                                                        |
| File uploads    | Client-side type/size checks only; nothing is uploaded                                                                  |
| Payments        | Manual TrxID flow UI with validation; no verification backend; gateways absent                                          |
| Chat & calls    | UI preview; WAN chat and calling modules are Phase 3. Calls show a message                                              |
| Ads             | Labelled placeholders; Central Ad Platform SDK is Phase 3                                                               |
| Skill tests     | Start dialog only; no question engine                                                                                   |
| Platform stats  | Demo numbers (labelled); computed from data in production                                                               |
| Bengali         | Header, footer, homepage, common strings and demo banner are translated; inner pages and dashboards are English for now |
| QR card         | Real QR code generated in the browser (pointing to the local URL)                                                       |
| Account numbers | Masked placeholders (`01XXXXXXXXX`)                                                                                     |

## Known gaps / to refine after your review

- Dashboard details follow the readable parts of the mockups; HD originals (Q12) would let me match them more closely.
- Mentor video intro and portfolio thumbnails are generated placeholders (no stock photos).
- Bengali translation of dashboard pages.
- Social logos in the footer are simple glyphs (lucide-react 1.x has no brand icons).
