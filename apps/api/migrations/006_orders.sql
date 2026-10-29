-- Phase 4: orders, matching offers, files, revisions, disputes.
-- Status flow (packages/contracts OrderStatus): awaiting_payment → payment_review → matching
-- → assigned → in_progress → delivered ⇄ revision_requested → approved → closed;
-- cancelled / disputed / refunded on the side. The API is the only writer; every change
-- also appends an order_events row.

create sequence order_code_seq start 24600;

create table orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('EK-' || nextval('order_code_seq')),
  student_id uuid not null references users(id),
  mentor_id uuid references users(id),
  preferred_mentor_id uuid references users(id),
  category_slug text not null references categories(slug),
  subject_id text not null references subjects(id),
  level text not null check (level in ('school', 'ssc', 'hsc', 'university', 'vocational')),
  work_type text not null references price_list(work_type),
  title text not null,
  instructions text not null,
  pages int not null check (pages between 1 and 300),
  delivery_method text not null check (delivery_method in ('digital', 'courier')),
  delivery_address text,
  deadline timestamptz not null,
  -- Price is fixed when the order is placed (price list + courier at that time).
  price_minor bigint not null check (price_minor > 0),
  currency text not null default 'BDT',
  commission_rate numeric(5, 4) not null check (commission_rate >= 0 and commission_rate <= 0.5),
  free_revisions int not null check (free_revisions >= 0),
  status text not null default 'awaiting_payment' check (status in (
    'awaiting_payment', 'payment_review', 'matching', 'assigned', 'in_progress', 'delivered',
    'revision_requested', 'approved', 'closed', 'cancelled', 'disputed', 'refunded')),
  -- Matching: waves of offers; true when the order waits for an admin to assign it.
  match_wave int not null default 0,
  needs_manual_assignment boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  matching_started_at timestamptz,
  assigned_at timestamptz,
  delivered_at timestamptz,
  approved_at timestamptz,
  closed_at timestamptz,
  cancelled_at timestamptz,
  check (mentor_id is null or mentor_id <> student_id),
  check (delivery_method <> 'courier' or delivery_address is not null)
);
create index orders_student on orders (student_id, created_at desc);
create index orders_mentor on orders (mentor_id, status) where mentor_id is not null;
create index orders_status on orders (status, updated_at);

create table order_events (
  id bigserial primary key,
  order_id uuid not null references orders(id) on delete cascade,
  at timestamptz not null default now(),
  kind text not null,
  status text not null,
  actor_id uuid references users(id),
  note text not null default '',
  details jsonb
);
create index order_events_order on order_events (order_id, id);

-- One offer per mentor per order. First valid acceptance wins (atomic update of orders).
create table order_offers (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  mentor_id uuid not null references users(id),
  wave int not null,
  status text not null default 'offered' check (status in ('offered', 'accepted', 'declined', 'expired', 'withdrawn')),
  score numeric not null default 0,
  offered_at timestamptz not null default now(),
  expires_at timestamptz not null,
  responded_at timestamptz,
  unique (order_id, mentor_id)
);
create index order_offers_open on order_offers (expires_at) where status = 'offered';
create index order_offers_mentor on order_offers (mentor_id, status);

create table order_files (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  uploaded_by uuid not null references users(id),
  stage text not null check (stage in ('requirement', 'preview', 'final')),
  -- Which delivery round a mentor file belongs to (0 = first delivery, n = after revision n).
  round int not null default 0,
  name text not null,
  content_type text not null,
  byte_size bigint not null check (byte_size > 0),
  storage_key text not null unique,
  status text not null default 'pending' check (status in ('pending', 'ready', 'deleted')),
  created_at timestamptz not null default now()
);
create index order_files_order on order_files (order_id, stage, round);

create table order_revisions (
  order_id uuid not null references orders(id) on delete cascade,
  n int not null check (n >= 1),
  instructions text not null,
  -- Beyond the free allowance a revision is paid (charged through payments, Phase 5).
  paid boolean not null,
  requested_by uuid not null references users(id),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  primary key (order_id, n)
);

create table disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  opened_by uuid not null references users(id),
  reason text not null,
  -- Status the order had when the dispute opened (restored when resolved without refund).
  order_status_before text not null,
  status text not null default 'open' check (status in ('open', 'resolved_refund', 'resolved_release', 'resolved_partial')),
  resolution_note text,
  refund_minor bigint check (refund_minor is null or refund_minor >= 0),
  resolved_by uuid references users(id),
  opened_at timestamptz not null default now(),
  resolved_at timestamptz
);
-- At most one open dispute per order.
create unique index disputes_one_open on disputes (order_id) where status = 'open';
