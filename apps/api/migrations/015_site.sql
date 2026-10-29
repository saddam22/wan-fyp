-- Website: contact messages (incl. the institutions' academic-integrity channel) and homepage banners.

create table contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text not null,
  topic text not null check (topic in ('order', 'payment', 'mentor', 'copyright', 'institution', 'other')),
  message text not null,
  user_id uuid references users(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'handled', 'spam')),
  note text,
  handled_by uuid references users(id),
  handled_at timestamptz,
  ip text not null default '',
  created_at timestamptz not null default now()
);
create index contact_messages_status on contact_messages (status, created_at desc);

create table home_banners (
  id uuid primary key default gen_random_uuid(),
  pre text not null default '',
  main text not null,
  post text not null default '',
  cta_label text,
  cta_href text check (cta_href is null or cta_href ~ '^(/[^/]|https://)'),
  tone text not null default 'blue' check (tone in ('blue', 'violet', 'teal', 'rose', 'amber')),
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
