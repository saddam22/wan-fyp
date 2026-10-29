-- Referral codes and attribution (rules ported from ICTSpark referral.controller/service).
-- Rewards are not recorded yet: they need completed orders and payments (Phases 4–5).

create table referral_codes (
  user_id uuid primary key references users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

-- One referrer per person, set once when they first join EduKhata, never changed.
create table referrals (
  referred_id uuid primary key references users(id) on delete cascade,
  referrer_id uuid not null references users(id) on delete cascade,
  code text not null,
  source text not null check (source in ('link', 'code')),
  attributed_at timestamptz not null default now(),
  check (referred_id <> referrer_id)
);
create index referrals_referrer on referrals (referrer_id, attributed_at desc);
