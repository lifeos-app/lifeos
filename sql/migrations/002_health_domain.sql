-- Migration 002: Health Domain
-- ALL ADDITIVE — no existing tables touched
-- Lateral integrations: schedule_events, expenses, journal_entries
-- NOTE: All existing tables use TEXT for id/user_id columns, so new tables match that convention
-- Applied: pending

-- ═══════════════════════════════════════════════════════════
-- HEALTH METRICS — daily snapshot (weight, height, mood, sleep, energy)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS health_metrics (
  id TEXT PRIMARY KEY DEFAULT extensions.uuid_generate_v4()::text,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  weight_kg DECIMAL(5,2),
  height_cm DECIMAL(5,1),
  bmi DECIMAL(4,1) GENERATED ALWAYS AS (
    CASE WHEN height_cm > 0 AND weight_kg > 0 
    THEN ROUND((weight_kg / ((height_cm/100.0) * (height_cm/100.0)))::numeric, 1)
    ELSE NULL END
  ) STORED,
  mood_score INT CHECK (mood_score BETWEEN 1 AND 5),
  energy_score INT CHECK (energy_score BETWEEN 1 AND 5),
  sleep_hours DECIMAL(4,2),
  sleep_quality INT CHECK (sleep_quality BETWEEN 1 AND 5),
  water_glasses INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_deleted BOOLEAN DEFAULT false,
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_health_metrics_user_date ON health_metrics(user_id, date DESC);

ALTER TABLE health_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own health_metrics" ON health_metrics
  FOR ALL USING (auth.uid()::text = user_id);

-- ═══════════════════════════════════════════════════════════
-- WORKOUT TEMPLATES — "Leg Day", "Push Day", "Cardio" etc.
-- day_of_week drives schedule integration
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS workout_templates (
  id TEXT PRIMARY KEY DEFAULT extensions.uuid_generate_v4()::text,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#39FF14',
  icon TEXT DEFAULT '💪',
  estimated_duration_min INT DEFAULT 60,
  day_of_week INT[] DEFAULT '{}', -- 0=Sun,1=Mon..6=Sat — DRIVES SCHEDULE
  preferred_time TIME DEFAULT '06:00',
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_deleted BOOLEAN DEFAULT false
);

ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own workout_templates" ON workout_templates
  FOR ALL USING (auth.uid()::text = user_id);

-- ═══════════════════════════════════════════════════════════
-- TEMPLATE EXERCISES — exercises within a workout template
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS template_exercises (
  id TEXT PRIMARY KEY DEFAULT extensions.uuid_generate_v4()::text,
  template_id TEXT REFERENCES workout_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  muscle_group TEXT, -- 'chest','back','legs','shoulders','arms','core','cardio','full_body'
  sets INT DEFAULT 3,
  reps INT DEFAULT 10,
  weight_kg DECIMAL(5,2),
  duration_min INT, -- for cardio/timed exercises
  rest_seconds INT DEFAULT 60,
  notes TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_deleted BOOLEAN DEFAULT false
);

ALTER TABLE template_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own template_exercises" ON template_exercises
  FOR ALL USING (
    EXISTS (SELECT 1 FROM workout_templates wt WHERE wt.id = template_id AND wt.user_id = auth.uid()::text)
  );

-- ═══════════════════════════════════════════════════════════
-- EXERCISE LOGS — actual completed workouts
-- Links to schedule_events (lateral: did you do the scheduled workout?)
-- Links to workout_templates (what program were you following?)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS exercise_logs (
  id TEXT PRIMARY KEY DEFAULT extensions.uuid_generate_v4()::text,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  template_id TEXT REFERENCES workout_templates(id),
  schedule_event_id TEXT REFERENCES schedule_events(id), -- ← SCHEDULE LINK
  date DATE NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_min INT,
  calories_burned INT,
  mood_before INT CHECK (mood_before BETWEEN 1 AND 5),
  mood_after INT CHECK (mood_after BETWEEN 1 AND 5),
  completed BOOLEAN DEFAULT false,
  skipped BOOLEAN DEFAULT false,
  skip_reason TEXT, -- "sore", "no time", "sick" — feeds into review + auto-reschedule
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_deleted BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_exercise_logs_user_date ON exercise_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_schedule ON exercise_logs(schedule_event_id);

ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own exercise_logs" ON exercise_logs
  FOR ALL USING (auth.uid()::text = user_id);

-- ═══════════════════════════════════════════════════════════
-- EXERCISE LOG SETS — individual sets within a logged workout
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS exercise_log_sets (
  id TEXT PRIMARY KEY DEFAULT extensions.uuid_generate_v4()::text,
  exercise_log_id TEXT REFERENCES exercise_logs(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  muscle_group TEXT,
  set_number INT NOT NULL,
  reps INT,
  weight_kg DECIMAL(5,2),
  duration_seconds INT,
  completed BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE exercise_log_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own exercise_log_sets" ON exercise_log_sets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM exercise_logs el WHERE el.id = exercise_log_id AND el.user_id = auth.uid()::text)
  );

-- ═══════════════════════════════════════════════════════════
-- BODY MARKERS — tap body part to log pain/injury/tension
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS body_markers (
  id TEXT PRIMARY KEY DEFAULT extensions.uuid_generate_v4()::text,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  body_part TEXT NOT NULL,
  marker_type TEXT NOT NULL CHECK (marker_type IN ('pain', 'injury', 'tension', 'soreness', 'note')),
  severity INT CHECK (severity BETWEEN 1 AND 5),
  description TEXT,
  date DATE NOT NULL,
  resolved BOOLEAN DEFAULT false,
  resolved_at DATE,
  affects_workout BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_deleted BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_body_markers_user_date ON body_markers(user_id, date DESC);

ALTER TABLE body_markers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own body_markers" ON body_markers
  FOR ALL USING (auth.uid()::text = user_id);

-- ═══════════════════════════════════════════════════════════
-- MEDITATION LOGS
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS meditation_logs (
  id TEXT PRIMARY KEY DEFAULT extensions.uuid_generate_v4()::text,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  duration_min INT NOT NULL,
  type TEXT DEFAULT 'silent' CHECK (type IN ('silent', 'guided', 'breathing', 'body_scan', 'prayer')),
  mood_before INT CHECK (mood_before BETWEEN 1 AND 5),
  mood_after INT CHECK (mood_after BETWEEN 1 AND 5),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_deleted BOOLEAN DEFAULT false
);

ALTER TABLE meditation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own meditation_logs" ON meditation_logs
  FOR ALL USING (auth.uid()::text = user_id);

-- ═══════════════════════════════════════════════════════════
-- GRATITUDE ENTRIES — feeds into journal_entries + review
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS gratitude_entries (
  id TEXT PRIMARY KEY DEFAULT extensions.uuid_generate_v4()::text,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  entry TEXT NOT NULL,
  category TEXT CHECK (category IN ('people', 'health', 'work', 'growth', 'faith', 'nature', 'other')),
  journal_entry_id TEXT, -- soft link to journal_entries(id) — created programmatically
  created_at TIMESTAMPTZ DEFAULT now(),
  is_deleted BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_gratitude_user_date ON gratitude_entries(user_id, date DESC);

ALTER TABLE gratitude_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own gratitude_entries" ON gratitude_entries
  FOR ALL USING (auth.uid()::text = user_id);

-- ═══════════════════════════════════════════════════════════
-- GROCERY LISTS — grouped shopping lists
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS grocery_lists (
  id TEXT PRIMARY KEY DEFAULT extensions.uuid_generate_v4()::text,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Shopping List',
  store TEXT, -- 'Woolworths', 'Aldi', 'Coles'
  budget DECIMAL(8,2),
  actual_total DECIMAL(8,2), -- computed from items → finance integration
  expense_id TEXT, -- ← FINANCE LINK: when list is "completed", creates expense in expenses table
  is_active BOOLEAN DEFAULT true,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_deleted BOOLEAN DEFAULT false
);

ALTER TABLE grocery_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own grocery_lists" ON grocery_lists
  FOR ALL USING (auth.uid()::text = user_id);

-- ═══════════════════════════════════════════════════════════
-- GROCERY ITEMS — items with cost tracking → finance
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS grocery_items (
  id TEXT PRIMARY KEY DEFAULT extensions.uuid_generate_v4()::text,
  list_id TEXT REFERENCES grocery_lists(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity TEXT, -- "2kg", "1 bunch", "500ml"
  category TEXT CHECK (category IN ('produce','dairy','meat','bakery','pantry','frozen','drinks','household','snacks','other')),
  estimated_cost DECIMAL(8,2),
  actual_cost DECIMAL(8,2), -- → rolls into grocery_lists.actual_total → expense
  checked BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_deleted BOOLEAN DEFAULT false
);

ALTER TABLE grocery_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own grocery_items" ON grocery_items
  FOR ALL USING (auth.uid()::text = user_id);

-- ═══════════════════════════════════════════════════════════
-- VIEWS — lateral integration queries
-- ═══════════════════════════════════════════════════════════

-- View: Missed workouts (scheduled but not logged) — feeds Review page
CREATE OR REPLACE VIEW missed_workouts AS
SELECT 
  se.id as event_id,
  se.user_id,
  se.title as workout_name,
  se.start_time::date as date,
  se.start_time,
  CASE 
    WHEN el.id IS NOT NULL AND el.completed = true THEN 'completed'
    WHEN el.id IS NOT NULL AND el.skipped = true THEN 'skipped'
    WHEN se.start_time < now() THEN 'missed'
    ELSE 'upcoming'
  END as status,
  el.skip_reason,
  el.mood_before,
  el.mood_after
FROM schedule_events se
LEFT JOIN exercise_logs el ON el.schedule_event_id = se.id
WHERE se.is_deleted = false
  AND (EXISTS (SELECT 1 FROM exercise_logs el2 WHERE el2.schedule_event_id = se.id)
  OR se.title ILIKE '%workout%' OR se.title ILIKE '%gym%' OR se.title ILIKE '%leg day%' 
  OR se.title ILIKE '%push day%' OR se.title ILIKE '%pull day%' OR se.title ILIKE '%cardio%');

-- View: Daily health summary — feeds Dashboard widget
CREATE OR REPLACE VIEW daily_health_summary AS
SELECT 
  hm.user_id,
  hm.date,
  hm.weight_kg,
  hm.mood_score,
  hm.energy_score,
  hm.sleep_hours,
  hm.sleep_quality,
  hm.water_glasses,
  (SELECT COUNT(*) FROM exercise_logs el WHERE el.user_id = hm.user_id AND el.date = hm.date AND el.completed = true) as workouts_done,
  (SELECT COUNT(*) FROM meditation_logs ml WHERE ml.user_id = hm.user_id AND ml.date = hm.date) as meditations_done,
  (SELECT SUM(ml.duration_min) FROM meditation_logs ml WHERE ml.user_id = hm.user_id AND ml.date = hm.date) as meditation_mins,
  (SELECT COUNT(*) FROM gratitude_entries ge WHERE ge.user_id = hm.user_id AND ge.date = hm.date AND ge.is_deleted = false) as gratitude_count,
  (SELECT COUNT(*) FROM meals m WHERE m.user_id = hm.user_id AND m.is_deleted = false AND m.created_at::date = hm.date) as meals_logged
FROM health_metrics hm
WHERE hm.is_deleted = false;

-- View: Weekly workout adherence — feeds Review page
CREATE OR REPLACE VIEW weekly_workout_adherence AS
SELECT 
  wt.user_id,
  wt.id as template_id,
  wt.name as workout_name,
  wt.day_of_week as scheduled_days,
  date_trunc('week', CURRENT_DATE)::date as week_start,
  (SELECT COUNT(*) FROM exercise_logs el 
   WHERE el.template_id = wt.id 
   AND el.date >= date_trunc('week', CURRENT_DATE)::date
   AND el.completed = true) as completed_this_week,
  array_length(wt.day_of_week, 1) as expected_this_week
FROM workout_templates wt
WHERE wt.is_active = true AND wt.is_deleted = false;
