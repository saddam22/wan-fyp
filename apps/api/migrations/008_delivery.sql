-- Phase 4d: paid revisions wait for payment; closure and reminder settings.
alter table order_revisions
  add column fee_minor bigint not null default 0 check (fee_minor >= 0),
  -- not_required: free revision (goes to the mentor at once); due: waiting for payment
  -- (Phase 5); paid: payment approved; cancelled: the student withdrew it.
  add column payment_status text not null default 'not_required'
    check (payment_status in ('not_required', 'due', 'paid', 'cancelled'));

alter table orders add column deadline_reminded_at timestamptz;

insert into platform_settings (key, value) values
  -- Price of a revision beyond the free ones, as a share of the order price (owner decision).
  ('paid_revision_fee_pct', '0.2'),
  ('max_revisions', '6'),
  -- Approved orders close after this many days (earnings become available, Phase 5).
  ('auto_close_days', '7'),
  ('deadline_reminder_hours', '24');
