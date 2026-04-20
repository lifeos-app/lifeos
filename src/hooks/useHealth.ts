// ═══════════════════════════════════════════════════════════
// useHealth — Re-export facade
//
// Split into focused modules:
//   useHealthTypes.ts    — shared type definitions
//   useHealthMetrics.ts  — daily metrics + dashboard summary
//   useExercise.ts       — workout templates, exercise logs, body markers
//   useWellbeing.ts      — meditation, gratitude
//   useMealsGrocery.ts   — meal tracking, grocery lists
// ═══════════════════════════════════════════════════════════

// Types
export type {
  HealthMetrics,
  WorkoutTemplate,
  TemplateExercise,
  ExerciseLog,
  ExerciseLogSet,
  BodyMarker,
  MeditationLog,
  GratitudeEntry,
  Meal,
  GroceryList,
  GroceryItem,
} from './useHealthTypes';

// Health Metrics
export { useHealthMetrics, useHealthSummary } from './useHealthMetrics';

// Exercise
export { useWorkoutTemplates, useExerciseLogs, useBodyMarkers } from './useExercise';

// Wellbeing
export { useMeditation, useGratitude } from './useWellbeing';

// Meals & Grocery
export { useMeals, useGroceryLists } from './useMealsGrocery';

// Smart Sleep
export { useSmartBedtime, useSleepInsights } from './useSmartSleep';
export type { BedtimeState, SleepInsight, SleepInsights } from './useSmartSleep';
