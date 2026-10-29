-- Guardian ↔ student links (rules ported from ICTSpark parent.controller, hardened).

-- One active link code per student. Only its SHA-256 is stored; the student sees the
-- code once, when it is created. It works once and expires.
create table guardian_link_codes (
  student_id uuid primary key references users(id) on delete cascade,
  code_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- The student decides what each guardian may see or do. Guardians never see chats.
create table guardian_links (
  guardian_id uuid not null references users(id) on delete cascade,
  student_id uuid not null references users(id) on delete cascade,
  view_orders boolean not null default true,
  view_payments boolean not null default true,
  pay_on_behalf boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (guardian_id, student_id),
  check (guardian_id <> student_id)
);
create index guardian_links_student on guardian_links (student_id);

-- Failed link attempts, for the per-guardian limit on guessing codes.
create table guardian_link_failures (
  guardian_id uuid not null references users(id) on delete cascade,
  at timestamptz not null default now()
);
create index guardian_link_failures_recent on guardian_link_failures (guardian_id, at);
