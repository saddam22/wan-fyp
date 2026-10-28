# Frontend Audit — Mockup Review & Page Inventory

## Mockups received (2026-10-28)

| # | Image | What it shows |
|---|---|---|
| 1 | Composite: EduKhata homepage (left) + 6 dashboard thumbnails (right) | Homepage v1; Student, Mentor, Admin, Accountant, Supporter dashboards; Live Chat & Video Session |
| 2 | EduKhata homepage v2 (desktop) | Same header/sidebars, new hero ("Your Complete Assignment & Practical Solution Platform"), shorter page |
| 3 | **WAN FYP** — "Final Year Project Portal", Project Overview dashboard + "Submit Project Revision" modal | A different product (matches the empty `wan-fyp` repo). **Out of EduKhata scope** (owner decision Q2) |

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

| Token | Value (approx.) | Use |
|---|---|---|
| `--brand` | #1D4ED8 / #2563EB | primary buttons, links, active nav, student dashboard |
| `--success` | #16A34A | Become a Mentor, approve, accountant dashboard accent |
| `--danger` | #E11D48 | Post Assignment, reject, admin dashboard accent |
| `--mentor` | #6D28D9 | mentor dashboard accent |
| `--support` | #F97316 | supporter dashboard accent, badges |
| `--navy` | #0B1B3F | stats band, footer |
| `--surface` | #FFFFFF on #F5F7FB page | cards |
| radius | 10–12 px cards, 8 px inputs, full pills | |
| type | Inter (Latin) + Hind Siliguri (Bengali) | as in Hub/ICTSpark |

Each role dashboard keeps the same shell (left sidebar, top bar, KPI cards) with its own accent colour — visible in the thumbnails.

## Items in the mockup that conflict with verified capabilities

| Mockup element | Problem | Proposal |
|---|---|---|
| Hard-coded stats (50,000+ students, 98%…) | Would be false claims at launch | Compute from DB; hide a stat below a threshold |
| "Live Chat & Video **with Recording**" | Calling module has no recording | Show "Live Chat & Video" until recording is approved (Q11) |
| "Secure Payment & Money Hold", "Payment Release" | Holding funds — legal check (Q5) | Keep wording only after approval |
| "10+ Countries" | Launch is Bangladesh only | "Bangladesh — expanding" |
| Live Classes ▾, Exams ▾ nav | Not in the 18 modules; ICTSpark has them | Q3: link to ICTSpark, or remove |
| Cart icon | Orders are custom, one at a time | Use as "My Orders / drafts" or remove (Q13) |
| App store badges | No mobile app exists | Hide until apps exist |

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
