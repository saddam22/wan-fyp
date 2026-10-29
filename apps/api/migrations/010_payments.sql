-- Phase 5a: manual payments (ICTSpark's send-money + TrxID flow, hardened).

-- Where students send money. Managed by accountants / super admins.
create table payment_accounts (
  id uuid primary key default gen_random_uuid(),
  method text not null check (method in ('bkash', 'nagad', 'rocket', 'bank')),
  channel text not null check (channel in ('personal', 'agent', 'merchant', 'bank')),
  name text not null,
  -- Mobile number, or bank account number.
  number text not null,
  account_name text,
  branch text,
  routing text,
  instructions text[] not null default '{}',
  enabled boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((method = 'bank') = (channel = 'bank'))
);

create sequence invoice_seq;

create table payments (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null unique default ('INV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('invoice_seq')::text, 6, '0')),
  order_id uuid not null references orders(id),
  purpose text not null check (purpose in ('order', 'revision')),
  revision_n int,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'BDT',
  -- pending: nothing submitted; submitted: TrxID waiting for a check; rejected: the payer
  -- may submit again; approved; refunded (Phase 5c); cancelled (order cancelled unpaid).
  status text not null default 'pending' check (status in ('pending', 'submitted', 'rejected', 'approved', 'refunded', 'cancelled')),
  payer_id uuid references users(id),
  account_id uuid references payment_accounts(id),
  method text check (method in ('bkash', 'nagad', 'rocket', 'bank')),
  channel text check (channel in ('personal', 'agent', 'merchant', 'bank')),
  sender text,
  trx_id text,
  proof_key text,
  submitted_at timestamptz,
  decided_at timestamptz,
  decided_by uuid references users(id),
  note text,
  reconciled_at timestamptz,
  reconciled_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((purpose = 'revision') = (revision_n is not null))
);
-- One live payment per order (or per paid revision).
create unique index payments_one_live on payments (order_id, purpose, coalesce(revision_n, 0))
  where status in ('pending', 'submitted', 'rejected', 'approved');
-- A TrxID backs one payment only (ICTSpark checked this with a racy exists(); here the
-- database refuses). A rejected submission frees its TrxID.
create unique index payments_trx_unique on payments (method, trx_id)
  where trx_id is not null and status in ('submitted', 'approved', 'refunded');
create index payments_queue on payments (status, submitted_at);

-- Every submission and decision, kept for the audit trail.
create table payment_attempts (
  id bigserial primary key,
  payment_id uuid not null references payments(id) on delete cascade,
  payer_id uuid not null references users(id),
  account_id uuid not null references payment_accounts(id),
  sender text not null,
  trx_id text not null,
  proof_key text,
  submitted_at timestamptz not null default now(),
  decision text not null default 'pending' check (decision in ('pending', 'approved', 'rejected')),
  decided_by uuid references users(id),
  decided_at timestamptz,
  note text
);
create index payment_attempts_payment on payment_attempts (payment_id, id);
