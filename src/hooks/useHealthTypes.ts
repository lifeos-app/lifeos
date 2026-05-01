// ═══════════════════════════════════════════════════════════
// Health Module — Shared Types
// ═══════════════════════════════════════════════════════════

export interface HealthMetrics {
  id?: string;
  date: string;
  weight_kg?: number;
  height_cm?: number;
  bmi?: number;
  mood_score?: number;
  energy_score?: number;
  sleep_hours?: number;
  sleep_quality?: number;
  water_glasses?: number;
  notes?: string;
}

export interface WorkoutTemplate {
  id?: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  workout_type?: string;
  estimated_duration_min: number;
  day_of_week: number[];
  preferred_time: string;
  is_active: boolean;
  auto_sync?: boolean;
  exercises?: TemplateExercise[];
}

export interface TemplateExercise {
  id?: string;
  template_id?: string;
  name: string;
  muscle_group?: string;
  sets: number;
  reps: number;
  weight_kg?: number;
  duration_min?: number;
  rest_seconds: number;
  notes?: string;
  sort_order: number;
  equipment?: string;
}

export interface ExerciseLog {
  id?: string;
  template_id?: string;
  schedule_event_id?: string;
  date: string;
  started_at?: string;
  completed_at?: string;
  duration_min?: number;
  calories_burned?: number;
  mood_before?: number;
  mood_after?: number;
  completed: boolean;
  skipped: boolean;
  skip_reason?: string;
  notes?: string;
  template?: WorkoutTemplate;
  sets?: ExerciseLogSet[];
}

export interface ExerciseLogSet {
  id?: string;
  exercise_log_id?: string;
  exercise_name: string;
  muscle_group?: string;
  set_number: number;
  reps?: number;
  weight_kg?: number;
  duration_seconds?: number;
  completed: boolean;
}

export interface BodyMarker {
  id?: string;
  body_part: string;
  marker_type: 'pain' | 'injury' | 'tension' | 'soreness' | 'note';
  severity: number;
  description?: string;
  date: string;
  resolved: boolean;
  affects_workout: boolean;
}

export interface MeditationLog {
  id?: string;
  date: string;
  duration_min: number;
  type: 'silent' | 'guided' | 'breathing' | 'body_scan' | 'prayer';
  mood_before?: number;
  mood_after?: number;
  notes?: string;
}

export interface GratitudeEntry {
  id?: string;
  date: string;
  entry: string;
  category?: string;
  journal_entry_id?: string;
}

export interface Meal {
  id?: string;
  date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  description: string;
  photo_url?: string;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  rating?: number;
  created_at?: string;
}

export interface GroceryList {
  id?: string;
  name: string;
  store?: string;
  budget?: number;
  actual_total?: number;
  expense_id?: string;
  is_active: boolean;
  items?: GroceryItem[];
  completed_at?: string;
}

export interface GroceryItem {
  id?: string;
  list_id?: string;
  name: string;
  quantity?: string;
  category?: string;
  estimated_cost?: number;
  actual_cost?: number;
  checked: boolean;
  sort_order: number;
}
