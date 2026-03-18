import type { HealthMetrics, WorkoutTemplate, TemplateExercise, BodyMarker, ExerciseLogSet, Meal } from '../../hooks/useHealth';

export type { HealthMetrics, WorkoutTemplate, TemplateExercise, BodyMarker, ExerciseLogSet, Meal };

export type HealthTab = 'overview' | 'body' | 'exercise' | 'diet' | 'mind' | 'sleep' | 'equipment';

export interface CSSVarStyle extends React.CSSProperties {
  [key: `--${string}`]: string | number;
}

// ── Mood config ──
export const MOOD_LABELS = ['Awful', 'Low', 'Okay', 'Good', 'Great'];
export const MOOD_COLORS = ['#EF4444', '#F43F5E', '#FDCB6E', '#39FF14', '#00D4FF'];

export const COMMON_EXERCISES = [
  { name: 'Push-ups', muscle_group: 'chest', sets: 3, reps: 15, rest_seconds: 60 },
  { name: 'Pull-ups', muscle_group: 'back', sets: 3, reps: 10, rest_seconds: 90 },
  { name: 'Squats', muscle_group: 'legs', sets: 4, reps: 12, rest_seconds: 90 },
  { name: 'Lunges', muscle_group: 'legs', sets: 3, reps: 12, rest_seconds: 60 },
  { name: 'Deadlifts', muscle_group: 'back', sets: 4, reps: 8, rest_seconds: 120 },
  { name: 'Bench Press', muscle_group: 'chest', sets: 4, reps: 10, rest_seconds: 90 },
  { name: 'Overhead Press', muscle_group: 'shoulders', sets: 3, reps: 10, rest_seconds: 90 },
  { name: 'Barbell Rows', muscle_group: 'back', sets: 4, reps: 10, rest_seconds: 90 },
  { name: 'Bicep Curls', muscle_group: 'arms', sets: 3, reps: 12, rest_seconds: 60 },
  { name: 'Tricep Dips', muscle_group: 'arms', sets: 3, reps: 12, rest_seconds: 60 },
  { name: 'Plank', muscle_group: 'core', sets: 3, reps: 1, rest_seconds: 60, duration_min: 1 },
  { name: 'Crunches', muscle_group: 'core', sets: 3, reps: 20, rest_seconds: 45 },
  { name: 'Running', muscle_group: 'cardio', sets: 1, reps: 1, rest_seconds: 0, duration_min: 30 },
  { name: 'Cycling', muscle_group: 'cardio', sets: 1, reps: 1, rest_seconds: 0, duration_min: 30 },
  { name: 'Jump Rope', muscle_group: 'cardio', sets: 3, reps: 1, rest_seconds: 30, duration_min: 5 },
  { name: 'Burpees', muscle_group: 'full_body', sets: 3, reps: 10, rest_seconds: 60 },
  { name: 'Mountain Climbers', muscle_group: 'core', sets: 3, reps: 20, rest_seconds: 45 },
  { name: 'Leg Press', muscle_group: 'legs', sets: 4, reps: 10, rest_seconds: 90 },
  { name: 'Calf Raises', muscle_group: 'legs', sets: 3, reps: 15, rest_seconds: 45 },
  { name: 'Lat Pulldown', muscle_group: 'back', sets: 3, reps: 12, rest_seconds: 90 },
] as const;

export function calculateHealthScore(metrics: HealthMetrics | undefined, workoutsToday: number, meditationMins: number, gratitudeCount: number): number {
  let score = 0;
  if (metrics?.mood_score) score += metrics.mood_score * 4;
  if (metrics?.sleep_hours) score += Math.min(metrics.sleep_hours / 8, 1) * 20;
  if (metrics?.water_glasses) score += Math.min(metrics.water_glasses / 8, 1) * 15;
  if (metrics?.energy_score) score += metrics.energy_score * 3;
  if (workoutsToday > 0) score += 15;
  if (meditationMins > 0) score += Math.min(meditationMins / 10, 1) * 10;
  if (gratitudeCount > 0) score += 5;
  return Math.round(score);
}
