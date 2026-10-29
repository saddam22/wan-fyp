-- Owner decisions: the transfer fee of a payout is the mentor's (deducted from what is sent);
-- verification documents are kept 6 months after the decision, then deleted.
alter table payouts
  add column fee_minor bigint not null default 0,
  add constraint payouts_fee_check check (fee_minor >= 0 and fee_minor < amount_minor);

alter table verification_files add column deleted_at timestamptz;

insert into platform_settings (key, value) values
  ('payout_fee_estimate_pct', '0.0185'),
  ('payout_fee_max_pct', '0.05'),
  ('verification_doc_retention_days', '180');
