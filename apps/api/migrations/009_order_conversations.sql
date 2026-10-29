-- Phase 4e: the chat conversation of each order (student ↔ assigned mentor).
-- Direct chats are one per pair, so several orders of the same pair share one.
create table order_conversations (
  order_id uuid primary key references orders(id) on delete cascade,
  conversation_id uuid not null,
  created_at timestamptz not null default now()
);
