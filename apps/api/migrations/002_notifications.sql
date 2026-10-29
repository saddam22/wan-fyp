-- Notifications for the WAN social module's NotificationService (repository contract in
-- modules/social/src/notifications/types.ts, schema after its reference/schema.prisma).

create table notifications (
  id uuid primary key,
  recipient_id uuid not null references users(id) on delete cascade,
  type text not null,
  category text not null,
  actor_ids uuid[] not null default '{}',
  actor_count int not null default 0,
  target_type text,
  target_id text,
  link text not null check (link like '/%' and link not like '//%'),
  group_key text,
  dedupe_key text,
  data jsonb not null default '{}',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  seen_at timestamptz,
  read_at timestamptz,
  archived_at timestamptz,
  unique (recipient_id, dedupe_key)
);
create index notifications_list_idx on notifications (recipient_id, archived_at, updated_at desc, id desc);
create index notifications_group_idx on notifications (recipient_id, group_key, updated_at);
create index notifications_created_idx on notifications (created_at);

create table notification_preferences (
  user_id uuid primary key references users(id) on delete cascade,
  categories jsonb not null default '{}',
  quiet_hours jsonb,
  email_digest text not null default 'off',
  muted_sources text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table notification_deliveries (
  id uuid primary key,
  notification_id uuid not null references notifications(id) on delete cascade,
  recipient_id uuid not null references users(id) on delete cascade,
  channel text not null check (channel in ('push', 'email')),
  status text not null check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempts int not null default 0,
  last_error_code text,
  next_attempt_at timestamptz not null,
  created_at timestamptz not null
);
create index notification_deliveries_due_idx on notification_deliveries (status, next_attempt_at);
create unique index notification_deliveries_pending_uq on notification_deliveries (notification_id, channel) where status = 'pending';

create table push_subscriptions (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null,
  last_used_at timestamptz
);
create index push_subscriptions_user_idx on push_subscriptions (user_id);
