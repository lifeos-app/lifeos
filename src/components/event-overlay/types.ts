// ═══ Types & Helpers — EventOverlay System ═══

import type { WorkoutTemplate } from '../../hooks/useHealth';

export interface ActiveEvent {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  color?: string;
  event_type?: string;
  category?: string;
  day_type?: string;
  workout_template_id?: string;
  workoutTemplate?: WorkoutTemplate;
  metadata?: Record<string, unknown>;
}

export interface OverlayState {
  activeEvent: ActiveEvent | null;
  isMinimized: boolean;
  isVisible: boolean;
}

export interface EventOverlayContextValue {
  overlayState: OverlayState;
  startOverlay: (event: ActiveEvent) => void;
  closeOverlay: () => void;
  toggleMinimize: () => void;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
}

export type OverlayEventType = 'workout' | 'meal' | 'sleep' | 'meditation' | 'study' | 'reading' | 'generic';

export type OverlayTab = 'activity' | 'log' | 'details';

export function detectEventType(event: ActiveEvent): OverlayEventType {
  const t = (event.event_type || event.day_type || '').toLowerCase();
  const title = event.title.toLowerCase();

  // Exercise / Workout
  if (t === 'exercise' || t === 'workout' || t === 'health' || event.workout_template_id || event.workoutTemplate) return 'workout';
  if (/\b(workout|exercise|gym|lift|squat|bench|cardio|run)\b/.test(title)) return 'workout';

  // Meal
  if (t === 'meal') return 'meal';
  if (/\b(breakfast|lunch|dinner|meal|snack|cook|eat|food)\b/.test(title)) return 'meal';

  // Sleep
  if (t === 'sleep') return 'sleep';
  if (/\b(sleep|nap|bed)\b/.test(title)) return 'sleep';

  // Meditation / Prayer
  if (t === 'meditation' || t === 'prayer') return 'meditation';
  if (/\b(meditat|pray|mindful|contemplat)\b/.test(title)) return 'meditation';

  // Study / Education
  if (t === 'education') return 'study';
  if (/\b(study|learn|course|class|lecture|homework)\b/.test(title)) return 'study';

  // Reading (legacy)
  if (t === 'reading' || /\b(read|book)\b/.test(title)) return 'reading';

  return 'generic';
}
