-- Grace.AI Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query → paste → Run

-- Conversations table
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default 'New Conversation',
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Studies table
create table if not exists studies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  study_data jsonb not null,
  created_at timestamptz not null default now()
);

-- Row Level Security: users can only access their own data
alter table conversations enable row level security;
alter table studies enable row level security;

create policy "Users read own conversations"
  on conversations for select
  using (auth.uid() = user_id);

create policy "Users insert own conversations"
  on conversations for insert
  with check (auth.uid() = user_id);

create policy "Users update own conversations"
  on conversations for update
  using (auth.uid() = user_id);

create policy "Users delete own conversations"
  on conversations for delete
  using (auth.uid() = user_id);

create policy "Users read own studies"
  on studies for select
  using (auth.uid() = user_id);

create policy "Users insert own studies"
  on studies for insert
  with check (auth.uid() = user_id);

create policy "Users delete own studies"
  on studies for delete
  using (auth.uid() = user_id);

-- Indexes for performance
create index if not exists idx_conversations_user on conversations(user_id, updated_at desc);
create index if not exists idx_studies_user on studies(user_id, created_at desc);
