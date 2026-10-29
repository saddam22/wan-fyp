-- Owner decision (Q5): the mentor's share is released only when both sides confirm —
-- the student approves the work and the mentor who did it confirms completion.
alter table orders
  add column mentor_confirmed_at timestamptz,
  add column confirm_reminded_at timestamptz;
