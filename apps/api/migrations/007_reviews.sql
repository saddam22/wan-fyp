-- Phase 4: reviews of a mentor by the student, one per order, after approval.
-- Published reviews feed the organic ranking (matching) and the public profile.
create table reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id) on delete cascade,
  mentor_id uuid not null references users(id),
  student_id uuid not null references users(id),
  rating int not null check (rating between 1 and 5),
  text text not null default '',
  status text not null default 'published' check (status in ('published', 'pending', 'hidden')),
  moderated_by uuid references users(id),
  moderation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reviews_mentor on reviews (mentor_id, status, created_at desc);
