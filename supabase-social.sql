-- Grace.AI Social Features Schema
-- Run this in: Supabase Dashboard > SQL Editor > New Query > paste > Run

-- Add display_name to profiles
alter table profiles add column if not exists display_name text;

-- Groups
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  invite_code text unique not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Group members
create table if not exists group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'member' check (role in ('member', 'leader')),
  joined_at timestamptz not null default now(),
  unique(group_id, user_id)
);

-- Activity feed
create table if not exists activity_feed (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  group_id uuid references groups(id) on delete cascade not null,
  activity_type text not null check (activity_type in (
    'study_completed', 'streak_milestone', 'reflection',
    'joined_group', 'study_shared'
  )),
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Reactions (amen / praying)
create table if not exists reactions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid references activity_feed(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  reaction_type text not null check (reaction_type in ('amen', 'praying')),
  created_at timestamptz not null default now(),
  unique(activity_id, user_id, reaction_type)
);

-- Devotional reflections
create table if not exists reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  group_id uuid references groups(id) on delete cascade not null,
  devotional_date date not null default current_date,
  reflection_text text not null check (char_length(reflection_text) <= 500),
  created_at timestamptz not null default now()
);

-- ── Row Level Security ──

alter table groups enable row level security;
alter table group_members enable row level security;
alter table activity_feed enable row level security;
alter table reactions enable row level security;
alter table reflections enable row level security;

-- Groups: readable by everyone (needed for join-by-code lookup), writable by authenticated users
create policy "Anyone can read groups" on groups for select using (true);
create policy "Authenticated users create groups" on groups for insert
  with check (auth.uid() = created_by);

-- Group members: readable by fellow group members, users can join/leave
create policy "Members see fellow members" on group_members for select
  using (group_id in (select group_id from group_members gm where gm.user_id = auth.uid()));
create policy "Users can join groups" on group_members for insert
  with check (auth.uid() = user_id);
create policy "Users can leave groups" on group_members for delete
  using (auth.uid() = user_id);

-- Activity feed: readable by group members, users post their own
create policy "Members read group feed" on activity_feed for select
  using (group_id in (select group_id from group_members where user_id = auth.uid()));
create policy "Members post to group feed" on activity_feed for insert
  with check (auth.uid() = user_id and group_id in (
    select group_id from group_members where user_id = auth.uid()
  ));

-- Reactions: readable by group members, users manage their own
create policy "Members read reactions" on reactions for select
  using (activity_id in (
    select id from activity_feed where group_id in (
      select group_id from group_members where user_id = auth.uid()
    )
  ));
create policy "Users add reactions" on reactions for insert
  with check (auth.uid() = user_id);
create policy "Users remove own reactions" on reactions for delete
  using (auth.uid() = user_id);

-- Reflections: readable by group members, users post their own
create policy "Members read group reflections" on reflections for select
  using (group_id in (select group_id from group_members where user_id = auth.uid()));
create policy "Members post reflections" on reflections for insert
  with check (auth.uid() = user_id and group_id in (
    select group_id from group_members where user_id = auth.uid()
  ));

-- ── Indexes ──
create index if not exists idx_group_members_user on group_members(user_id);
create index if not exists idx_group_members_group on group_members(group_id);
create index if not exists idx_activity_feed_group on activity_feed(group_id, created_at desc);
create index if not exists idx_activity_feed_user on activity_feed(user_id);
create index if not exists idx_reactions_activity on reactions(activity_id);
create index if not exists idx_reflections_group on reflections(group_id, devotional_date desc);

-- ── Update existing profiles with default display_name ──
update profiles set display_name = split_part(
  (select email from auth.users where auth.users.id = profiles.id), '@', 1
) where display_name is null;
