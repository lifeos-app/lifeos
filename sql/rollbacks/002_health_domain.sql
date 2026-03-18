-- Rollback 002: Health Domain
-- Drops all health domain tables + views (safe, no existing tables affected)
DROP VIEW IF EXISTS weekly_workout_adherence;
DROP VIEW IF EXISTS daily_health_summary;
DROP VIEW IF EXISTS missed_workouts;
DROP TABLE IF EXISTS grocery_items;
DROP TABLE IF EXISTS grocery_lists;
DROP TABLE IF EXISTS gratitude_entries;
DROP TABLE IF EXISTS meditation_logs;
DROP TABLE IF EXISTS body_markers;
DROP TABLE IF EXISTS exercise_log_sets;
DROP TABLE IF EXISTS exercise_logs;
DROP TABLE IF EXISTS template_exercises;
DROP TABLE IF EXISTS workout_templates;
DROP TABLE IF EXISTS health_metrics;
