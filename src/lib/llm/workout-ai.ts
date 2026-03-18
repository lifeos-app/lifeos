/**
 * AI Workout Generator — LifeOS
 *
 * Generates personalized workout plans using the LLM proxy.
 * Considers fitness level, goals, equipment, recent history,
 * and available time to create optimal training plans.
 */

import { callLLMJson } from '../llm-proxy';
import { supabase } from '../supabase';
import { logger } from '../../utils/logger';

// ── TYPES ──────────────────────────────────────────────────

export interface WorkoutRequest {
  goal: string;           // 'lose_weight' | 'build_muscle' | 'stay_fit' | 'flexibility' | 'endurance'
  workoutType: string;    // 'cardio' | 'strength' | 'hiit' | 'mixed' | 'flexibility'
  durationMin: number;    // 15, 30, 45, 60, 90
  equipment: string[];    // ['none', 'dumbbells', 'barbell', 'machine', 'kettlebell', ...]
  fitnessLevel?: string;  // 'beginner' | 'intermediate' | 'advanced'
  bodyWeight?: number;    // kg — for bodyweight-relative suggestions
}

export interface GeneratedExercise {
  name: string;
  muscle_group: string;
  sets: number;
  reps: number;
  weight_kg?: number;
  duration_min?: number;
  rest_seconds: number;
  equipment: string;
  notes?: string;
  sort_order: number;
}

export interface GeneratedWorkout {
  name: string;
  description: string;
  workout_type: string;
  estimated_duration_min: number;
  color: string;
  icon: string;
  exercises: GeneratedExercise[];
  warmup?: string;
  cooldown?: string;
  difficulty: string;
  muscle_groups_targeted: string[];
}

// ── RECENT HISTORY FETCHER ─────────────────────────────────

interface RecentWorkoutSummary {
  date: string;
  muscle_groups: string[];
  exercises: string[];
  duration_min: number;
}

async function getRecentWorkoutHistory(days: number = 7): Promise<RecentWorkoutSummary[]> {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return [];

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().split('T')[0];

  const { data: logs } = await supabase
    .from('exercise_logs')
    .select('date, duration_min, exercise_log_sets(exercise_name, muscle_group, completed)')
    .eq('user_id', user.user.id)
    .eq('is_deleted', false)
    .eq('completed', true)
    .gte('date', sinceStr)
    .order('date', { ascending: false });

  if (!logs) return [];

  return logs.map((log: any) => {
    const sets = log.exercise_log_sets || [];
    const muscleGroups = [...new Set(sets.filter((s: any) => s.completed && s.muscle_group).map((s: any) => s.muscle_group))] as string[];
    const exercises = [...new Set(sets.filter((s: any) => s.completed).map((s: any) => s.exercise_name))] as string[];
    return {
      date: log.date,
      muscle_groups: muscleGroups,
      exercises,
      duration_min: log.duration_min || 0,
    };
  });
}

async function getUserFitnessProfile(): Promise<{ weight?: number; fitnessLevel?: string }> {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return {};

  const { data: metrics } = await supabase
    .from('health_metrics')
    .select('weight_kg')
    .eq('user_id', user.user.id)
    .eq('is_deleted', false)
    .not('weight_kg', 'is', null)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    weight: metrics?.weight_kg || undefined,
  };
}

// ── MUSCLE GROUP FATIGUE CHECK ─────────────────────────────

function getMuscleGroupsTrainedRecently(
  history: RecentWorkoutSummary[],
  hoursAgo: number = 48
): string[] {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - hoursAgo);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const recentGroups = new Set<string>();
  for (const workout of history) {
    if (workout.date >= cutoffStr) {
      workout.muscle_groups.forEach(g => recentGroups.add(g));
    }
  }
  return [...recentGroups];
}

// ── GOAL/TYPE METADATA ─────────────────────────────────────

const GOAL_LABELS: Record<string, string> = {
  lose_weight: 'fat loss and calorie burning',
  build_muscle: 'muscle hypertrophy and strength gains',
  stay_fit: 'general fitness and overall health',
  flexibility: 'flexibility, mobility, and recovery',
  endurance: 'cardiovascular endurance and stamina',
};

const WORKOUT_TYPE_LABELS: Record<string, string> = {
  cardio: 'cardio-focused exercises',
  strength: 'resistance training with progressive overload',
  hiit: 'high-intensity interval training',
  mixed: 'a mix of strength and cardio',
  flexibility: 'stretching, yoga, and mobility work',
};

const GOAL_COLORS: Record<string, string> = {
  lose_weight: '#F43F5E',
  build_muscle: '#39FF14',
  stay_fit: '#00D4FF',
  flexibility: '#74B9FF',
  endurance: '#FDCB6E',
};

const GOAL_ICONS: Record<string, string> = {
  lose_weight: '🔥',
  build_muscle: '💪',
  stay_fit: '🏃',
  flexibility: '🧘',
  endurance: '⚡',
};

// ── MAIN AI GENERATION ─────────────────────────────────────

export async function generateAIWorkout(request: WorkoutRequest): Promise<GeneratedWorkout> {
  // Fetch recent history and fitness profile in parallel
  const [history, profile] = await Promise.all([
    getRecentWorkoutHistory(7),
    getUserFitnessProfile(),
  ]);

  const fatigued = getMuscleGroupsTrainedRecently(history, 48);
  const fitnessLevel = request.fitnessLevel || profile.fitnessLevel || 'intermediate';
  const bodyWeight = request.bodyWeight || profile.weight;

  // Build the prompt
  const prompt = buildWorkoutPrompt(request, {
    fitnessLevel,
    bodyWeight,
    fatiguedMuscleGroups: fatigued,
    recentHistory: history,
  });

  let workout: GeneratedWorkout;
  try {
    workout = await callLLMJson<GeneratedWorkout>(prompt, { timeoutMs: 25000 });
  } catch (err) {
    logger.warn('[workout-ai] AI generation failed, using fallback:', err);
    return generateFallbackWorkout(request);
  }

  // Enrich with metadata
  workout.color = workout.color || GOAL_COLORS[request.goal] || '#00D4FF';
  workout.icon = workout.icon || GOAL_ICONS[request.goal] || '💪';
  workout.estimated_duration_min = request.durationMin;
  workout.exercises = (workout.exercises || []).map((ex, i) => ({
    ...ex,
    sort_order: i,
    muscle_group: ex.muscle_group || 'full_body',
    equipment: ex.equipment || 'none',
    rest_seconds: ex.rest_seconds || 60,
  }));

  return workout;
}

// ── PROMPT BUILDER ─────────────────────────────────────────

interface PromptContext {
  fitnessLevel: string;
  bodyWeight?: number;
  fatiguedMuscleGroups: string[];
  recentHistory: RecentWorkoutSummary[];
}

function buildWorkoutPrompt(request: WorkoutRequest, ctx: PromptContext): string {
  const goalDesc = GOAL_LABELS[request.goal] || request.goal;
  const typeDesc = WORKOUT_TYPE_LABELS[request.workoutType] || request.workoutType;

  const equipmentList = request.equipment.length > 0
    ? request.equipment.join(', ')
    : 'bodyweight only (no equipment)';

  const fatigueWarning = ctx.fatiguedMuscleGroups.length > 0
    ? `\n⚠️ AVOID these muscle groups (trained in last 48 hours): ${ctx.fatiguedMuscleGroups.join(', ')}. Choose complementary or different muscle groups to prevent overtraining.`
    : '';

  const historySection = ctx.recentHistory.length > 0
    ? `\nRecent workout history (last 7 days):\n${ctx.recentHistory.map(h =>
        `- ${h.date}: ${h.exercises.slice(0, 4).join(', ')}${h.exercises.length > 4 ? ` (+${h.exercises.length - 4} more)` : ''} (${h.duration_min}min, muscles: ${h.muscle_groups.join(', ')})`
      ).join('\n')}`
    : '\nNo recent workout history.';

  const weightCtx = ctx.bodyWeight
    ? `\nUser body weight: ${ctx.bodyWeight}kg. Suggest appropriate weights relative to this.`
    : '';

  return `You are a certified personal trainer AI. Generate a single workout plan.

REQUIREMENTS:
- Goal: ${goalDesc}
- Workout type: ${typeDesc}
- Duration: ${request.durationMin} minutes total (including rest periods)
- Available equipment: ${equipmentList}
- Fitness level: ${ctx.fitnessLevel}${weightCtx}${fatigueWarning}${historySection}

Respond with a JSON object matching this exact structure:
{
  "name": "Short catchy workout name (2-4 words)",
  "description": "One sentence describing the workout",
  "workout_type": "${request.workoutType}",
  "estimated_duration_min": ${request.durationMin},
  "difficulty": "${ctx.fitnessLevel}",
  "muscle_groups_targeted": ["list", "of", "muscle", "groups"],
  "warmup": "Brief warmup instructions (1-2 sentences)",
  "cooldown": "Brief cooldown instructions (1-2 sentences)",
  "exercises": [
    {
      "name": "Exercise Name",
      "muscle_group": "one of: chest, back, legs, arms, shoulders, core, cardio, full_body",
      "sets": 3,
      "reps": 12,
      "weight_kg": null,
      "duration_min": null,
      "rest_seconds": 60,
      "equipment": "none or specific equipment",
      "notes": "Optional form tip or variation"
    }
  ]
}

RULES:
- Include 4-8 exercises that fit within ${request.durationMin} minutes (account for rest periods)
- For cardio/timed exercises, set reps to 1 and use duration_min instead
- weight_kg should be null for bodyweight exercises, realistic for weighted exercises
- rest_seconds: 20-30s for HIIT, 60s for general, 90-120s for heavy strength
- ${ctx.fitnessLevel === 'beginner' ? 'Keep exercises simple and safe. 2-3 sets. Lower weights.' : ''}
- ${ctx.fitnessLevel === 'advanced' ? 'Include compound movements and supersets. 4-5 sets. Challenge the user.' : ''}
- Muscle group values must be one of: chest, back, legs, arms, shoulders, core, cardio, full_body
- Return ONLY the JSON object, no extra text.`;
}

// ── QUICK WORKOUT PRESETS (no AI needed) ───────────────────

export interface QuickWorkoutPreset {
  id: string;
  name: string;
  icon: string;
  durationMin: number;
  color: string;
  description: string;
  exercises: GeneratedExercise[];
}

export const QUICK_PRESETS: QuickWorkoutPreset[] = [
  {
    id: 'quick-15',
    name: '15min Burn',
    icon: '🔥',
    durationMin: 15,
    color: '#F43F5E',
    description: 'Fast full-body blast — no equipment needed',
    exercises: [
      { name: 'Jumping Jacks', muscle_group: 'cardio', sets: 2, reps: 30, rest_seconds: 15, equipment: 'none', sort_order: 0 },
      { name: 'Push-ups', muscle_group: 'chest', sets: 3, reps: 12, rest_seconds: 20, equipment: 'none', sort_order: 1 },
      { name: 'Bodyweight Squats', muscle_group: 'legs', sets: 3, reps: 15, rest_seconds: 20, equipment: 'none', sort_order: 2 },
      { name: 'Plank', muscle_group: 'core', sets: 2, reps: 1, duration_min: 0.75, rest_seconds: 15, equipment: 'none', sort_order: 3 },
      { name: 'Burpees', muscle_group: 'full_body', sets: 2, reps: 8, rest_seconds: 20, equipment: 'none', sort_order: 4 },
    ],
  },
  {
    id: 'quick-30',
    name: '30min Strength',
    icon: '💪',
    durationMin: 30,
    color: '#39FF14',
    description: 'Effective strength circuit — dumbbells optional',
    exercises: [
      { name: 'Push-ups', muscle_group: 'chest', sets: 3, reps: 15, rest_seconds: 45, equipment: 'none', sort_order: 0 },
      { name: 'Dumbbell Rows', muscle_group: 'back', sets: 3, reps: 12, rest_seconds: 45, equipment: 'dumbbells', sort_order: 1 },
      { name: 'Goblet Squats', muscle_group: 'legs', sets: 3, reps: 12, rest_seconds: 60, equipment: 'dumbbells', sort_order: 2 },
      { name: 'Overhead Press', muscle_group: 'shoulders', sets: 3, reps: 10, rest_seconds: 60, equipment: 'dumbbells', sort_order: 3 },
      { name: 'Lunges', muscle_group: 'legs', sets: 3, reps: 12, rest_seconds: 45, equipment: 'none', sort_order: 4 },
      { name: 'Plank', muscle_group: 'core', sets: 3, reps: 1, duration_min: 1, rest_seconds: 30, equipment: 'none', sort_order: 5 },
    ],
  },
  {
    id: 'quick-45',
    name: '45min HIIT',
    icon: '⚡',
    durationMin: 45,
    color: '#FDCB6E',
    description: 'Heart-pumping intervals — max calorie burn',
    exercises: [
      { name: 'High Knees', muscle_group: 'cardio', sets: 4, reps: 30, rest_seconds: 20, equipment: 'none', sort_order: 0 },
      { name: 'Burpees', muscle_group: 'full_body', sets: 4, reps: 10, rest_seconds: 30, equipment: 'none', sort_order: 1 },
      { name: 'Mountain Climbers', muscle_group: 'core', sets: 4, reps: 20, rest_seconds: 20, equipment: 'none', sort_order: 2 },
      { name: 'Squat Jumps', muscle_group: 'legs', sets: 4, reps: 12, rest_seconds: 30, equipment: 'none', sort_order: 3 },
      { name: 'Push-up to Shoulder Tap', muscle_group: 'chest', sets: 3, reps: 10, rest_seconds: 30, equipment: 'none', sort_order: 4 },
      { name: 'Plank Jacks', muscle_group: 'core', sets: 3, reps: 20, rest_seconds: 20, equipment: 'none', sort_order: 5 },
      { name: 'Jumping Lunges', muscle_group: 'legs', sets: 3, reps: 12, rest_seconds: 30, equipment: 'none', sort_order: 6 },
    ],
  },
  {
    id: 'quick-60',
    name: '60min Full Body',
    icon: '🏋️',
    durationMin: 60,
    color: '#A855F7',
    description: 'Complete workout — strength + cardio finisher',
    exercises: [
      { name: 'Barbell Squats', muscle_group: 'legs', sets: 4, reps: 10, weight_kg: 40, rest_seconds: 90, equipment: 'barbell', sort_order: 0 },
      { name: 'Bench Press', muscle_group: 'chest', sets: 4, reps: 10, weight_kg: 30, rest_seconds: 90, equipment: 'barbell', sort_order: 1 },
      { name: 'Bent Over Rows', muscle_group: 'back', sets: 4, reps: 10, weight_kg: 30, rest_seconds: 90, equipment: 'barbell', sort_order: 2 },
      { name: 'Overhead Press', muscle_group: 'shoulders', sets: 3, reps: 10, weight_kg: 20, rest_seconds: 60, equipment: 'dumbbells', sort_order: 3 },
      { name: 'Romanian Deadlifts', muscle_group: 'legs', sets: 3, reps: 10, weight_kg: 30, rest_seconds: 90, equipment: 'barbell', sort_order: 4 },
      { name: 'Bicep Curls', muscle_group: 'arms', sets: 3, reps: 12, weight_kg: 10, rest_seconds: 45, equipment: 'dumbbells', sort_order: 5 },
      { name: 'Tricep Dips', muscle_group: 'arms', sets: 3, reps: 12, rest_seconds: 45, equipment: 'bench', sort_order: 6 },
      { name: 'Plank', muscle_group: 'core', sets: 3, reps: 1, duration_min: 1, rest_seconds: 30, equipment: 'none', sort_order: 7 },
    ],
  },
];

// ── FALLBACK GENERATOR (no API, offline-safe) ──────────────

const FALLBACK_EXERCISES: Record<string, GeneratedExercise[]> = {
  chest: [
    { name: 'Push-ups', muscle_group: 'chest', sets: 3, reps: 15, rest_seconds: 60, equipment: 'none', sort_order: 0 },
    { name: 'Diamond Push-ups', muscle_group: 'chest', sets: 3, reps: 10, rest_seconds: 60, equipment: 'none', sort_order: 0 },
    { name: 'Wide Push-ups', muscle_group: 'chest', sets: 3, reps: 12, rest_seconds: 45, equipment: 'none', sort_order: 0 },
  ],
  back: [
    { name: 'Superman Hold', muscle_group: 'back', sets: 3, reps: 1, duration_min: 0.5, rest_seconds: 45, equipment: 'none', sort_order: 0 },
    { name: 'Reverse Snow Angels', muscle_group: 'back', sets: 3, reps: 12, rest_seconds: 45, equipment: 'none', sort_order: 0 },
  ],
  legs: [
    { name: 'Bodyweight Squats', muscle_group: 'legs', sets: 3, reps: 15, rest_seconds: 60, equipment: 'none', sort_order: 0 },
    { name: 'Lunges', muscle_group: 'legs', sets: 3, reps: 12, rest_seconds: 60, equipment: 'none', sort_order: 0 },
    { name: 'Calf Raises', muscle_group: 'legs', sets: 3, reps: 20, rest_seconds: 30, equipment: 'none', sort_order: 0 },
    { name: 'Wall Sit', muscle_group: 'legs', sets: 3, reps: 1, duration_min: 0.75, rest_seconds: 45, equipment: 'none', sort_order: 0 },
  ],
  core: [
    { name: 'Plank', muscle_group: 'core', sets: 3, reps: 1, duration_min: 1, rest_seconds: 30, equipment: 'none', sort_order: 0 },
    { name: 'Crunches', muscle_group: 'core', sets: 3, reps: 20, rest_seconds: 30, equipment: 'none', sort_order: 0 },
    { name: 'Mountain Climbers', muscle_group: 'core', sets: 3, reps: 20, rest_seconds: 30, equipment: 'none', sort_order: 0 },
    { name: 'Bicycle Crunches', muscle_group: 'core', sets: 3, reps: 20, rest_seconds: 30, equipment: 'none', sort_order: 0 },
  ],
  cardio: [
    { name: 'Jumping Jacks', muscle_group: 'cardio', sets: 3, reps: 30, rest_seconds: 20, equipment: 'none', sort_order: 0 },
    { name: 'High Knees', muscle_group: 'cardio', sets: 3, reps: 30, rest_seconds: 20, equipment: 'none', sort_order: 0 },
    { name: 'Burpees', muscle_group: 'full_body', sets: 3, reps: 10, rest_seconds: 30, equipment: 'none', sort_order: 0 },
  ],
  shoulders: [
    { name: 'Pike Push-ups', muscle_group: 'shoulders', sets: 3, reps: 10, rest_seconds: 60, equipment: 'none', sort_order: 0 },
    { name: 'Arm Circles', muscle_group: 'shoulders', sets: 2, reps: 20, rest_seconds: 20, equipment: 'none', sort_order: 0 },
  ],
  arms: [
    { name: 'Tricep Dips (floor)', muscle_group: 'arms', sets: 3, reps: 12, rest_seconds: 45, equipment: 'none', sort_order: 0 },
    { name: 'Chin-up Hold', muscle_group: 'arms', sets: 3, reps: 1, duration_min: 0.5, rest_seconds: 60, equipment: 'pull-up bar', sort_order: 0 },
  ],
};

export function generateFallbackWorkout(request: WorkoutRequest): GeneratedWorkout {
  const allGroups = Object.keys(FALLBACK_EXERCISES);
  const goalGroupMap: Record<string, string[]> = {
    lose_weight: ['cardio', 'legs', 'core', 'chest'],
    build_muscle: ['chest', 'back', 'legs', 'shoulders', 'arms'],
    stay_fit: ['chest', 'legs', 'core', 'cardio'],
    flexibility: ['core', 'legs', 'back'],
    endurance: ['cardio', 'legs', 'core'],
  };

  const targetGroups = goalGroupMap[request.goal] || goalGroupMap.stay_fit;
  const exerciseCount = request.durationMin <= 20 ? 4 : request.durationMin <= 35 ? 5 : request.durationMin <= 50 ? 6 : 7;

  const exercises: GeneratedExercise[] = [];
  let idx = 0;
  for (let i = 0; i < exerciseCount; i++) {
    const group = targetGroups[i % targetGroups.length];
    const pool = FALLBACK_EXERCISES[group] || FALLBACK_EXERCISES.core;
    const ex = pool[idx % pool.length];
    exercises.push({ ...ex, sort_order: i });
    if ((i + 1) % targetGroups.length === 0) idx++;
  }

  return {
    name: `${request.durationMin}min ${request.workoutType.charAt(0).toUpperCase() + request.workoutType.slice(1)}`,
    description: `A ${request.durationMin}-minute ${request.workoutType} workout for ${GOAL_LABELS[request.goal] || 'general fitness'}`,
    workout_type: request.workoutType,
    estimated_duration_min: request.durationMin,
    color: GOAL_COLORS[request.goal] || '#00D4FF',
    icon: GOAL_ICONS[request.goal] || '💪',
    exercises,
    difficulty: request.fitnessLevel || 'intermediate',
    muscle_groups_targeted: [...new Set(exercises.map(e => e.muscle_group))],
    warmup: '2 minutes of light jogging in place and dynamic stretching',
    cooldown: '3 minutes of static stretching focusing on worked muscle groups',
  };
}
