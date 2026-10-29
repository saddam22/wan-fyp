-- Phase 6: mentor verification, skill tests, promotions (paid, labelled), coupons, content.

-- ---- Verification (ICTSpark MentorApplication review flow, with private documents) ----

alter table mentor_profiles
  add column verified_at timestamptz,
  add column verified_by uuid references users(id);

create table mentor_verifications (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  note text not null default '',
  decision_note text,
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (reviewed_by is null or reviewed_by <> mentor_id)
);
create unique index mentor_verifications_one_pending on mentor_verifications (mentor_id) where status = 'pending';

create table verification_files (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid references mentor_verifications(id) on delete cascade,
  mentor_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('identity', 'qualification', 'institution', 'other')),
  name text not null,
  content_type text not null,
  byte_size int not null,
  storage_key text not null unique,
  uploaded boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---- Skill tests (server-graded multiple choice) ----

create table skill_tests (
  id uuid primary key default gen_random_uuid(),
  subject_id text not null references subjects(id),
  title text not null,
  pass_pct int not null default 70 check (pass_pct between 1 and 100),
  duration_min int not null default 20 check (duration_min between 1 and 180),
  active boolean not null default true,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table skill_questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references skill_tests(id) on delete cascade,
  prompt text not null,
  options text[] not null check (cardinality(options) between 2 and 6),
  correct int not null,
  sort int not null default 0,
  check (correct >= 0 and correct < cardinality(options))
);

create table skill_attempts (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references skill_tests(id) on delete cascade,
  mentor_id uuid not null references users(id) on delete cascade,
  question_ids uuid[] not null,
  started_at timestamptz not null default now(),
  deadline timestamptz not null,
  submitted_at timestamptz,
  score_pct int,
  passed boolean
);
create unique index skill_attempts_one_open on skill_attempts (test_id, mentor_id) where submitted_at is null;

-- ---- Promotions: boosts and subscriptions, paid from the mentor's balance ----

create table mentor_promotions (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('boost', 'pro_monthly', 'pro_yearly')),
  price_minor bigint not null check (price_minor >= 0),
  currency char(3) not null default 'BDT',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  reminded_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index mentor_promotions_active on mentor_promotions (mentor_id) where status = 'active';

alter table ledger_transactions add column promotion_id uuid references mentor_promotions(id);

-- ---- Coupons ----

create table coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_-]{3,24}$'),
  kind text not null check (kind in ('percent', 'fixed')),
  value int not null check (value > 0),
  max_discount_minor bigint,
  min_order_minor bigint not null default 0,
  max_uses int,
  per_user int not null default 1 check (per_user >= 1),
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  check (kind <> 'percent' or value <= 100)
);

create table coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references coupons(id),
  user_id uuid not null references users(id),
  order_id uuid not null unique references orders(id) on delete cascade,
  discount_minor bigint not null,
  status text not null default 'active' check (status in ('active', 'released')),
  created_at timestamptz not null default now()
);

alter table orders
  add column list_price_minor bigint,
  add column discount_minor bigint not null default 0,
  add column coupon_id uuid references coupons(id);

-- ---- Content: blog posts and pages (ICTSpark blog status flow) ----

create table content_posts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('blog', 'page')),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  excerpt text not null default '',
  body text not null default '',
  category text not null default 'general',
  status text not null default 'draft' check (status in ('draft', 'pending', 'published', 'rejected', 'hidden')),
  author_id uuid references users(id),
  review_note text,
  reviewed_by uuid references users(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, slug)
);

insert into platform_settings (key, value) values
  ('require_verified_mentors', 'false'),
  ('skill_retake_days', '7'),
  ('boost_7d_minor', '20000'),
  ('pro_monthly_minor', '30000'),
  ('pro_yearly_minor', '300000');

-- Promotion revenue is a ledger account of its own.
alter table ledger_entries drop constraint ledger_entries_account_check;
alter table ledger_entries add constraint ledger_entries_account_check check (account ~ '^(cash:[0-9a-f-]{36}|escrow:order:[0-9a-f-]{36}|mentor:[0-9a-f-]{36}:(pending|available)|revenue:commission|revenue:promotions|refunds:payable|payouts:payable)$');
