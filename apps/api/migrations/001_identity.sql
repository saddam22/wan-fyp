-- EduKhata identity & access. People come from WAN Identity Hub (OIDC `sub`);
-- marketplace roles, profiles and sessions are owned here.

create table users (
  id uuid primary key default gen_random_uuid(),
  wan_sub text not null unique,
  name text not null,
  email text,
  email_verified boolean not null default false,
  phone text,
  phone_verified boolean not null default false,
  locale text,
  -- Marketplace-level suspension (separate from the hub's platform entitlement).
  status text not null default 'active' check (status in ('active', 'suspended')),
  status_reason text,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

-- Roles are granted here, never by signing in.
create table user_roles (
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('student', 'guardian', 'mentor', 'supporter', 'accountant', 'admin', 'super_admin')),
  granted_by uuid references users(id),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table student_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  institution text not null,
  class_level text not null,
  board text,
  subjects text[] not null default '{}',
  country char(2) not null default 'BD',
  show_on_leaderboard boolean not null default false,
  updated_at timestamptz not null default now()
);

create table guardian_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  country char(2) not null default 'BD',
  updated_at timestamptz not null default now()
);

-- Browser sessions (cookie `ek_sid`; only its SHA-256 is stored).
create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  ip text not null default '',
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  hub_checked_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index sessions_user_idx on sessions (user_id) where revoked_at is null;

-- OIDC sign-in in progress: state → nonce + PKCE verifier (single use, 10 minutes).
create table auth_transactions (
  state text primary key,
  nonce text not null,
  code_verifier text not null,
  next_path text not null default '/',
  expires_at timestamptz not null
);

create table audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor_id uuid references users(id),
  action text not null,
  target text not null default '',
  details jsonb,
  ip text not null default ''
);
create index audit_log_at_idx on audit_log (at desc);
