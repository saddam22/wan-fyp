-- Phase 5b: double-entry ledger. Every money event is one transaction whose entries sum
-- to zero (positive = debit, negative = credit). Append-only: no updates or deletes.
--
-- Accounts:
--   cash:<payment_account_id>   money in EduKhata's receiving accounts (asset)
--   escrow:order:<order_id>     money held for an order until the work is approved (liability)
--   mentor:<user_id>:pending    mentor earnings of approved orders not yet closed (liability)
--   mentor:<user_id>:available  mentor earnings that can be paid out (liability)
--   revenue:commission          platform commission (income)
--   refunds:payable             refunds decided but not yet sent (liability)
--   payouts:payable             payouts requested but not yet sent (liability)

create table ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  -- One posting per business event (e.g. "payment:<id>:received").
  idempotency_key text not null unique,
  kind text not null,
  memo text not null default '',
  order_id uuid references orders(id),
  payment_id uuid references payments(id),
  actor_id uuid references users(id),
  created_at timestamptz not null default now()
);

create table ledger_entries (
  id bigserial primary key,
  txn_id uuid not null references ledger_transactions(id),
  account text not null check (account ~ '^(cash:[0-9a-f-]{36}|escrow:order:[0-9a-f-]{36}|mentor:[0-9a-f-]{36}:(pending|available)|revenue:commission|refunds:payable|payouts:payable)$'),
  amount_minor bigint not null check (amount_minor <> 0),
  currency text not null default 'BDT',
  created_at timestamptz not null default now()
);
create index ledger_entries_account on ledger_entries (account, id);
create index ledger_entries_txn on ledger_entries (txn_id);

-- Balanced: checked at commit, so a transaction's entries can be inserted one by one.
create function ledger_check_balanced() returns trigger language plpgsql as $$
declare total bigint; n int;
begin
  select coalesce(sum(amount_minor), 0), count(*) into total, n from ledger_entries where txn_id = new.txn_id;
  if total <> 0 or n < 2 then
    raise exception 'ledger transaction % is not balanced (sum %, % entries)', new.txn_id, total, n;
  end if;
  return null;
end $$;
create constraint trigger ledger_balanced after insert on ledger_entries
  deferrable initially deferred for each row execute function ledger_check_balanced();

create function ledger_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'the ledger is append-only (correct it with a new transaction)';
end $$;
create trigger ledger_entries_immutable before update or delete on ledger_entries
  for each row execute function ledger_immutable();
create trigger ledger_transactions_immutable before update or delete on ledger_transactions
  for each row execute function ledger_immutable();
