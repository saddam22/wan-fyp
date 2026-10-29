-- Phase 5c: refunds and payouts (two people: one asks/decides, another approves; payouts
-- are paid by someone other than the approver).

create table refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'BDT',
  source text not null check (source in ('cancellation', 'dispute')),
  reason text not null,
  -- Where to send it (taken from the payer's submission).
  to_method text,
  to_number text,
  status text not null default 'requested' check (status in ('requested', 'approved', 'paid')),
  requested_by uuid not null references users(id),
  approved_by uuid references users(id),
  approved_at timestamptz,
  paid_by uuid references users(id),
  paid_at timestamptz,
  from_account_id uuid references payment_accounts(id),
  reference text,
  created_at timestamptz not null default now(),
  check (approved_by is null or approved_by <> requested_by)
);
create index refunds_status on refunds (status, created_at);

create table payouts (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references users(id),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'BDT',
  method text not null check (method in ('bkash', 'nagad', 'rocket', 'bank')),
  account text not null,
  account_name text,
  status text not null default 'requested' check (status in ('requested', 'approved', 'paid', 'rejected')),
  requested_at timestamptz not null default now(),
  approved_by uuid references users(id),
  approved_at timestamptz,
  paid_by uuid references users(id),
  paid_at timestamptz,
  from_account_id uuid references payment_accounts(id),
  reference text,
  note text,
  check (approved_by is null or approved_by <> mentor_id),
  check (paid_by is null or (paid_by <> mentor_id and paid_by <> approved_by))
);
-- One open payout per mentor (no double requests).
create unique index payouts_one_open on payouts (mentor_id) where status in ('requested', 'approved');
-- A payout reference (TrxID of the money sent) is used once.
create unique index payouts_reference on payouts (method, reference) where reference is not null;
create unique index refunds_reference on refunds (to_method, reference) where reference is not null;

alter table ledger_transactions add column refund_id uuid references refunds(id), add column payout_id uuid references payouts(id);

insert into platform_settings (key, value) values ('min_payout_minor', '50000');
