-- Grace.AI Community Platform Expansion (v2)
-- Run in: Supabase Dashboard > SQL Editor > New Query > paste > Run

-- ── Expand activity types ──
ALTER TABLE activity_feed DROP CONSTRAINT IF EXISTS activity_feed_activity_type_check;
ALTER TABLE activity_feed ADD CONSTRAINT activity_feed_activity_type_check
  CHECK (activity_type IN (
    'study_completed', 'streak_milestone', 'reflection',
    'joined_group', 'study_shared',
    'freeform_post', 'prayer_request', 'weekly_checkin',
    'reading_plan_completed', 'reading_day_completed'
  ));

-- ── New columns on activity_feed ──
ALTER TABLE activity_feed ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE activity_feed ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;
ALTER TABLE activity_feed ADD COLUMN IF NOT EXISTS is_answered boolean NOT NULL DEFAULT false;

-- ── Allow users to update their own activities (mark prayer as answered) ──
CREATE POLICY "Users update own activities" ON activity_feed FOR UPDATE
  USING (auth.uid() = user_id);

-- ── Reading Plans ──
CREATE TABLE IF NOT EXISTS reading_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  readings jsonb NOT NULL DEFAULT '[]'::jsonb,
  start_date date NOT NULL DEFAULT current_date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reading_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES reading_plans(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  day_number integer NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plan_id, user_id, day_number)
);

-- ── Weekly Check-ins ──
CREATE TABLE IF NOT EXISTS weekly_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  week_start date NOT NULL,
  response_text text NOT NULL CHECK (char_length(response_text) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, group_id, week_start)
);

-- ── Profile additions ──
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false;

-- ── RLS ──
ALTER TABLE reading_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_checkins ENABLE ROW LEVEL SECURITY;

-- Reading plans: members read, leaders create/update
CREATE POLICY "Members read group plans" ON reading_plans FOR SELECT
  USING (group_id IN (SELECT user_group_ids(auth.uid())));
CREATE POLICY "Leaders create plans" ON reading_plans FOR INSERT
  WITH CHECK (auth.uid() = created_by
    AND group_id IN (SELECT user_group_ids(auth.uid())));
CREATE POLICY "Leaders update plans" ON reading_plans FOR UPDATE
  USING (auth.uid() = created_by);

-- Reading progress: members read group progress, users mark their own
CREATE POLICY "Members read plan progress" ON reading_progress FOR SELECT
  USING (plan_id IN (
    SELECT id FROM reading_plans WHERE group_id IN (SELECT user_group_ids(auth.uid()))
  ));
CREATE POLICY "Users mark own progress" ON reading_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Weekly check-ins: members read, users post their own
CREATE POLICY "Members read group checkins" ON weekly_checkins FOR SELECT
  USING (group_id IN (SELECT user_group_ids(auth.uid())));
CREATE POLICY "Users post own checkins" ON weekly_checkins FOR INSERT
  WITH CHECK (auth.uid() = user_id
    AND group_id IN (SELECT user_group_ids(auth.uid())));

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_reading_plans_group ON reading_plans(group_id);
CREATE INDEX IF NOT EXISTS idx_reading_progress_plan ON reading_progress(plan_id, user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_checkins_group ON weekly_checkins(group_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_activity_feed_type ON activity_feed(activity_type, group_id);
