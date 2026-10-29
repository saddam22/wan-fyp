-- Phase 4a: catalog (admin-managed), platform settings, mentor profiles.
-- Seed values are the Phase 1 catalog (packages/contracts fixtures).

create table subjects (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  name text not null,
  name_bn text not null,
  levels text[] not null default '{}',
  active boolean not null default true,
  sort int not null default 0
);

create table categories (
  slug text primary key check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null,
  name_bn text not null,
  description text not null default '',
  icon text not null default 'BookOpen',
  tone text not null default 'blue',
  kind text not null check (kind in ('assignment', 'practical', 'project')),
  active boolean not null default true,
  sort int not null default 0
);

-- Price per page by type of work, in minor units (paisa). The server computes every price.
create table price_list (
  work_type text primary key
    check (work_type in ('digital', 'handwritten', 'practical_khata', 'biology_drawing', 'pencil_sketch', 'diagram')),
  per_page_minor bigint not null check (per_page_minor > 0),
  currency text not null default 'BDT',
  updated_at timestamptz not null default now()
);

-- Business rules that admins can change (super admin only); every change is audited.
create table platform_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references users(id),
  updated_at timestamptz not null default now()
);

create table mentor_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  headline text not null default '',
  bio text not null default '',
  institution text not null default '',
  education text not null default '',
  subjects text[] not null default '{}',
  work_types text[] not null default '{}',
  levels text[] not null default '{}',
  available boolean not null default false,
  capacity int not null default 3 check (capacity between 1 and 20),
  last_assigned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into subjects (id, name, name_bn, levels, sort) values
  ('biology', 'Biology', 'জীববিজ্ঞান', '{ssc,hsc,university}', 0),
  ('math', 'Math', 'গণিত', '{school,ssc,hsc,university}', 1),
  ('ict', 'ICT', 'আইসিটি', '{ssc,hsc,university}', 2),
  ('english', 'English', 'ইংরেজি', '{school,ssc,hsc,university}', 3),
  ('physics', 'Physics', 'পদার্থবিজ্ঞান', '{ssc,hsc,university}', 4),
  ('chemistry', 'Chemistry', 'রসায়ন', '{ssc,hsc,university}', 5),
  ('business', 'Business', 'ব্যবসায় শিক্ষা', '{ssc,hsc,university}', 6),
  ('bangla', 'Bangla', 'বাংলা', '{school,ssc,hsc}', 7),
  ('accounting', 'Accounting', 'হিসাববিজ্ঞান', '{hsc,university}', 8),
  ('engineering-drawing', 'Engineering Drawing', 'ইঞ্জিনিয়ারিং ড্রয়িং', '{vocational,university}', 9);

insert into categories (slug, name, name_bn, description, icon, tone, kind, sort) values
  ('ssc', 'SSC Assignments', 'এসএসসি অ্যাসাইনমেন্ট', 'Board-wise assignments for classes 9–10', 'GraduationCap', 'rose', 'assignment', 0),
  ('hsc', 'HSC Assignments', 'এইচএসসি অ্যাসাইনমেন্ট', 'Science, commerce and humanities', 'BookOpen', 'blue', 'assignment', 1),
  ('university', 'University Assignments', 'বিশ্ববিদ্যালয় অ্যাসাইনমেন্ট', 'Reports, case studies, lab work', 'Landmark', 'green', 'assignment', 2),
  ('practical-khata', 'Practical Khata (Handwritten)', 'প্র্যাকটিক্যাল খাতা (হাতে লেখা)', 'Neat handwritten practical notebooks', 'PenLine', 'amber', 'practical', 3),
  ('project-report', 'Project & Report', 'প্রজেক্ট ও রিপোর্ট', 'Project files, presentations, reports', 'FileText', 'violet', 'project', 4),
  ('vocational', 'ITI / Vocational', 'আইটিআই / ভোকেশনাল', 'Trade drawings and practical records', 'Wrench', 'teal', 'practical', 5),
  ('drawings', 'Biology Drawings & Diagrams', 'জীববিজ্ঞানের চিত্র ও ডায়াগ্রাম', 'Labelled drawings, pencil sketches', 'Brush', 'indigo', 'practical', 6);

insert into price_list (work_type, per_page_minor) values
  ('digital', 7000), ('handwritten', 5000), ('practical_khata', 5000),
  ('biology_drawing', 25000), ('pencil_sketch', 30000), ('diagram', 16000);

insert into platform_settings (key, value) values
  ('commission_rate', '0.2'),
  ('free_revisions', '2'),
  ('courier_fee_minor', '12000'),
  ('min_deadline_hours', '24'),
  ('offer_ttl_minutes', '15'),
  ('offer_wave_size', '3'),
  ('max_offer_waves', '4'),
  ('preferred_mentor_minutes', '30');
