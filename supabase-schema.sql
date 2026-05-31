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

-- Devotional views (one row per user per day for streak tracking)
create table if not exists devotional_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  viewed_date date not null default current_date,
  unique(user_id, viewed_date)
);

alter table devotional_views enable row level security;

create policy "Users read own devotional views"
  on devotional_views for select
  using (auth.uid() = user_id);

create policy "Users insert own devotional views"
  on devotional_views for insert
  with check (auth.uid() = user_id);

-- User profiles (plan status, preferences)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users read own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Indexes for performance
create index if not exists idx_conversations_user on conversations(user_id, updated_at desc);
create index if not exists idx_studies_user on studies(user_id, created_at desc);
create index if not exists idx_devotional_views_user on devotional_views(user_id, viewed_date desc);
