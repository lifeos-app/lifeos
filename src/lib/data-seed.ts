/**
 * data-seed.ts — Pre-Populated Intelligence Data Seeding
 *
 * When a new user completes onboarding, this module seeds their account with
 * intelligent defaults based on their answers. The vision:
 * "On first login, LifeOS isn't empty. It already knows your work schedule,
 * drive times, education goals."
 *
 * Seeds data via existing store methods (Zustand getState() pattern)
 * and localInsert for offline-first — data goes to IndexedDB first, syncs later.
 *
 * Idempotent: calling seedInitialData twice will not create duplicates.
 * All seeded items carry isSeeded: true for identification/filtering.
 * No emoji in any seeded content names per DESIGN-RULES.md.
 */

import { localInsert, localGetAll, getEffectiveUserId } from './local-db';
import { waitForInitialSync } from './sync-engine';
import { useHabitsStore } from '../stores/useHabitsStore';
import { useGoalsStore } from '../stores/useGoalsStore';
import { useScheduleStore } from '../stores/useScheduleStore';
import { useFinanceStore } from '../stores/useFinanceStore';
import { genId } from '../utils/date';
import { logger } from '../utils/logger';
import type { ExpenseCategory } from '../types/database';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface OnboardingAnswers {
  name: string;
  lifeSnapshot: Record<string, number>;
  topGoals: string[];
  dailyRhythm: 'student' | '9-5' | 'shift' | 'freelancer' | 'parent';
  wakeTime: string;   // HH:mm format, e.g. "06:30"
  sleepTime: string;  // HH:mm format, e.g. "22:00"
}

export interface SeedResult {
  habits: number;
  goals: number;
  events: number;
  categories: number;
}

// ═══════════════════════════════════════════════════════════════
// SEED MARKER — prevent duplicate seeding
// ═══════════════════════════════════════════════════════════════

const SEED_MARKER_KEY = 'lifeos_data_seeded';

/**
 * Check whether data has already been seeded for a given user.
 * Uses localStorage to persist the flag across sessions.
 */
function isAlreadySeeded(userId: string): boolean {
  try {
    const stored = localStorage.getItem(SEED_MARKER_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed[userId] === true;
    }
  } catch { /* ignore parse errors */ }
  return false;
}

/**
 * Mark that seeding has completed for a given user.
 */
function markSeeded(userId: string): void {
  try {
    const stored = localStorage.getItem(SEED_MARKER_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    parsed[userId] = true;
    localStorage.setItem(SEED_MARKER_KEY, JSON.stringify(parsed));
  } catch { /* ignore write errors */ }
}

// ═══════════════════════════════════════════════════════════════
// HABIT PRESETS — based on dailyRhythm and lifeSnapshot
// ═══════════════════════════════════════════════════════════════

interface HabitPreset {
  title: string;
  description: string;
  icon: string;         // lucide-style name, no emoji
  category: 'health' | 'finance' | 'productivity' | 'learning' | 'lifestyle';
  frequency: 'daily' | 'weekdays' | 'weekly' | '3x_week';
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'anytime';
  durationMinutes?: number;
}

const HABIT_PRESETS: Record<OnboardingAnswers['dailyRhythm'], HabitPreset[]> = {
  '9-5': [
    { title: 'Morning Routine', description: 'Structured start to the workday', icon: 'sunrise', category: 'productivity', frequency: 'weekdays', timeOfDay: 'morning', durationMinutes: 30 },
    { title: 'Lunch Walk', description: 'Move and reset during the midday break', icon: 'footprints', category: 'health', frequency: 'weekdays', timeOfDay: 'afternoon', durationMinutes: 15 },
    { title: 'Evening Wind-Down', description: 'Decompress and prepare for rest', icon: 'moon', category: 'lifestyle', frequency: 'daily', timeOfDay: 'evening', durationMinutes: 30 },
    { title: 'Hydration Check', description: 'Track water intake throughout the day', icon: 'droplets', category: 'health', frequency: 'daily', timeOfDay: 'anytime' },
    { title: 'Daily Review', description: 'Reflect on accomplishments and plan tomorrow', icon: 'clipboard-check', category: 'productivity', frequency: 'weekdays', timeOfDay: 'evening', durationMinutes: 10 },
    { title: 'Reading Time', description: 'Read for knowledge or relaxation', icon: 'book-open', category: 'learning', frequency: 'daily', timeOfDay: 'evening', durationMinutes: 20 },
  ],
  'student': [
    { title: 'Morning Study Block', description: 'Focused study session before classes', icon: 'graduation-cap', category: 'learning', frequency: 'weekdays', timeOfDay: 'morning', durationMinutes: 45 },
    { title: 'Midday Break', description: 'Step away from screen and recharge', icon: 'coffee', category: 'health', frequency: 'weekdays', timeOfDay: 'afternoon', durationMinutes: 15 },
    { title: 'Evening Review', description: 'Review notes and prepare for next day', icon: 'clipboard-check', category: 'productivity', frequency: 'daily', timeOfDay: 'evening', durationMinutes: 20 },
    { title: 'Hydration Check', description: 'Track water intake throughout the day', icon: 'droplets', category: 'health', frequency: 'daily', timeOfDay: 'anytime' },
    { title: 'Exercise Session', description: 'Physical activity to balance study', icon: 'dumbbell', category: 'health', frequency: '3x_week', timeOfDay: 'afternoon', durationMinutes: 30 },
    { title: 'Reading Time', description: 'Read beyond required coursework', icon: 'book-open', category: 'learning', frequency: 'daily', timeOfDay: 'evening', durationMinutes: 20 },
  ],
  'shift': [
    { title: 'Shift Prep', description: 'Prepare gear and mindset before shift', icon: 'hard-hat', category: 'productivity', frequency: 'daily', timeOfDay: 'morning', durationMinutes: 15 },
    { title: 'Post-Shift Recovery', description: 'Cool down and recover after work', icon: 'moon', category: 'health', frequency: 'daily', timeOfDay: 'evening', durationMinutes: 20 },
    { title: 'Hydration Check', description: 'Track water intake, especially during active shifts', icon: 'droplets', category: 'health', frequency: 'daily', timeOfDay: 'anytime' },
    { title: 'Meal Prep', description: 'Prepare meals ahead for irregular schedule', icon: 'utensils', category: 'lifestyle', frequency: 'weekly', timeOfDay: 'anytime', durationMinutes: 45 },
    { title: 'Exercise Session', description: 'Physical activity on off days', icon: 'dumbbell', category: 'health', frequency: '3x_week', timeOfDay: 'afternoon', durationMinutes: 30 },
    { title: 'Sleep Hygiene', description: 'Maintain consistent sleep despite shift changes', icon: 'bed', category: 'health', frequency: 'daily', timeOfDay: 'evening', durationMinutes: 10 },
  ],
  'freelancer': [
    { title: 'Morning Planning', description: 'Set priorities and structure for the day', icon: 'layout-list', category: 'productivity', frequency: 'daily', timeOfDay: 'morning', durationMinutes: 15 },
    { title: 'Deep Work Block', description: 'Uninterrupted focus on most important project', icon: 'focus', category: 'productivity', frequency: 'weekdays', timeOfDay: 'morning', durationMinutes: 90 },
    { title: 'Midday Reset', description: 'Step away from screen and move', icon: 'coffee', category: 'health', frequency: 'daily', timeOfDay: 'afternoon', durationMinutes: 15 },
    { title: 'Hydration Check', description: 'Track water intake throughout the day', icon: 'droplets', category: 'health', frequency: 'daily', timeOfDay: 'anytime' },
    { title: 'Client Follow-Up', description: 'Check in on outstanding invoices and messages', icon: 'send', category: 'finance', frequency: 'weekdays', timeOfDay: 'afternoon', durationMinutes: 15 },
    { title: 'Evening Wind-Down', description: 'Close the workday and separate work from life', icon: 'moon', category: 'lifestyle', frequency: 'daily', timeOfDay: 'evening', durationMinutes: 20 },
  ],
  'parent': [
    { title: 'Morning Routine', description: 'Start the day organized before the household wakes', icon: 'sunrise', category: 'productivity', frequency: 'daily', timeOfDay: 'morning', durationMinutes: 20 },
    { title: 'Family Meal Prep', description: 'Plan and prepare meals for the family', icon: 'utensils', category: 'lifestyle', frequency: 'daily', timeOfDay: 'afternoon', durationMinutes: 30 },
    { title: 'Evening Wind-Down', description: 'Quiet time after bedtime routines', icon: 'moon', category: 'lifestyle', frequency: 'daily', timeOfDay: 'evening', durationMinutes: 30 },
    { title: 'Hydration Check', description: 'Track water intake throughout the day', icon: 'droplets', category: 'health', frequency: 'daily', timeOfDay: 'anytime' },
    { title: 'Self-Care Time', description: 'Dedicated personal time for mental health', icon: 'heart', category: 'health', frequency: 'daily', timeOfDay: 'evening', durationMinutes: 15 },
    { title: 'Household Planning', description: 'Review schedule, appointments, and tasks for the week', icon: 'calendar-check', category: 'productivity', frequency: 'weekly', timeOfDay: 'morning', durationMinutes: 20 },
  ],
};

// ═══════════════════════════════════════════════════════════════
// SCHEDULE BLOCKS — based on dailyRhythm and wake/sleep times
// ═══════════════════════════════════════════════════════════════

interface ScheduleBlock {
  title: string;
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
  eventType: ScheduleEvent_type;
  color: string;
}

// Subset of event types that make sense for seeded blocks
type ScheduleEvent_type = 'block' | 'work' | 'education' | 'personal' | 'sleep';

const BLOCK_COLORS = {
  morning: '#4ECB71',   // green
  work: '#00D4FF',      // blue
  education: '#A855F7', // purple
  break: '#FFD93D',    // yellow
  evening: '#F97316',  // orange
  sleep: '#6366F1',    // indigo
  personal: '#EC4899', // pink
};

function generateScheduleBlocks(
  rhythm: OnboardingAnswers['dailyRhythm'],
  wakeTime: string,
  sleepTime: string,
): ScheduleBlock[] {
  const [wakeH, wakeM] = wakeTime.split(':').map(Number);
  const [sleepH, sleepM] = sleepTime.split(':').map(Number);

  // Convert to minutes for easier arithmetic
  const wakeMin = wakeH * 60 + wakeM;
  const sleepMin = sleepH * 60 + sleepM;

  // Helper to format minutes back to HH:mm
  const fmt = (m: number): string => {
    const h = Math.floor(m / 60) % 24;
    const mins = m % 60;
    return `${String(h).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  const blocks: ScheduleBlock[] = [];

  switch (rhythm) {
    case '9-5': {
      // Morning block: wake → 30 min before work start (09:00)
      const workStart = 9 * 60;
      blocks.push({ title: 'Morning Routine', startTime: fmt(wakeMin), endTime: fmt(Math.min(wakeMin + 60, workStart - 30)), eventType: 'personal', color: BLOCK_COLORS.morning });
      // Work block: 09:00–17:00
      blocks.push({ title: 'Work Block', startTime: '09:00', endTime: '17:00', eventType: 'work', color: BLOCK_COLORS.work });
      // Lunch break embedded
      blocks.push({ title: 'Lunch Break', startTime: '12:00', endTime: '13:00', eventType: 'break' as ScheduleEvent_type, color: BLOCK_COLORS.break });
      // Evening block: 17:00 → sleep
      blocks.push({ title: 'Evening', startTime: '17:00', endTime: sleepTime, eventType: 'personal', color: BLOCK_COLORS.evening });
      break;
    }
    case 'student': {
      const classStart = 8 * 60 + 30; // 08:30
      blocks.push({ title: 'Morning Routine', startTime: fmt(wakeMin), endTime: fmt(Math.min(wakeMin + 45, classStart - 15)), eventType: 'personal', color: BLOCK_COLORS.morning });
      blocks.push({ title: 'Class Block', startTime: '08:30', endTime: '15:00', eventType: 'education', color: BLOCK_COLORS.education });
      blocks.push({ title: 'Study Time', startTime: '15:30', endTime: '17:30', eventType: 'education', color: BLOCK_COLORS.education });
      blocks.push({ title: 'Evening', startTime: '18:00', endTime: sleepTime, eventType: 'personal', color: BLOCK_COLORS.evening });
      break;
    }
    case 'shift': {
      // Generic shift placeholder — user will customize
      blocks.push({ title: 'Morning Routine', startTime: fmt(wakeMin), endTime: fmt(wakeMin + 45), eventType: 'personal', color: BLOCK_COLORS.morning });
      blocks.push({ title: 'Shift Block', startTime: fmt(wakeMin + 60), endTime: fmt(wakeMin + 60 + 480), eventType: 'work', color: BLOCK_COLORS.work }); // 8h shift
      blocks.push({ title: 'Evening', startTime: fmt(wakeMin + 60 + 480 + 30), endTime: sleepTime, eventType: 'personal', color: BLOCK_COLORS.evening });
      break;
    }
    case 'freelancer': {
      blocks.push({ title: 'Morning Routine', startTime: fmt(wakeMin), endTime: fmt(wakeMin + 30), eventType: 'personal', color: BLOCK_COLORS.morning });
      blocks.push({ title: 'Deep Work', startTime: fmt(wakeMin + 30), endTime: fmt(wakeMin + 30 + 120), eventType: 'work', color: BLOCK_COLORS.work }); // 2h
      blocks.push({ title: 'Admin and Follow-Ups', startTime: fmt(wakeMin + 180), endTime: fmt(wakeMin + 180 + 60), eventType: 'work', color: BLOCK_COLORS.work }); // 1h
      blocks.push({ title: 'Second Work Block', startTime: fmt(wakeMin + 270), endTime: fmt(wakeMin + 270 + 90), eventType: 'work', color: BLOCK_COLORS.work }); // 1.5h
      blocks.push({ title: 'Evening', startTime: fmt(wakeMin + 420), endTime: sleepTime, eventType: 'personal', color: BLOCK_COLORS.evening });
      break;
    }
    case 'parent': {
      blocks.push({ title: 'Morning Routine', startTime: fmt(wakeMin), endTime: fmt(wakeMin + 45), eventType: 'personal', color: BLOCK_COLORS.morning });
      blocks.push({ title: 'Active Parenting', startTime: fmt(wakeMin + 45), endTime: '12:00', eventType: 'personal', color: BLOCK_COLORS.personal });
      blocks.push({ title: 'Midday Block', startTime: '12:00', endTime: '15:00', eventType: 'personal', color: BLOCK_COLORS.personal });
      blocks.push({ title: 'Afternoon', startTime: '15:00', endTime: '18:00', eventType: 'personal', color: BLOCK_COLORS.personal });
      blocks.push({ title: 'Evening Wind-Down', startTime: '18:00', endTime: sleepTime, eventType: 'personal', color: BLOCK_COLORS.evening });
      break;
    }
  }

  return blocks;
}

// ═══════════════════════════════════════════════════════════════
// MAIN SEED FUNCTION
// ═══════════════════════════════════════════════════════════════

/**
 * Seed initial data for a first-time user based on their onboarding answers.
 * Idempotent — calling twice will not create duplicates.
 *
 * @param userId - The authenticated user's ID
 * @param onboardingAnswers - Answers collected during onboarding
 * @returns SeedResult with counts of each entity created
 */
export async function seedInitialData(
  userId: string,
  onboardingAnswers: OnboardingAnswers,
): Promise<SeedResult> {
  const result: SeedResult = { habits: 0, goals: 0, events: 0, categories: 0 };

  // ── Idempotency check ──
  if (isAlreadySeeded(userId)) {
    logger.log('[data-seed] Already seeded for user', userId.slice(0, 8));
    return result;
  }

  // ── Ensure stores are loaded and synced ──
  await waitForInitialSync();

  // ── Double-check: query existing data to avoid collisions ──
  // If user somehow has existing habits/goals/events/categories, don't overwrite
  const [existingHabits, existingGoals, existingEvents, existingCategories] = await Promise.all([
    localGetAll('habits'),
    localGetAll('goals'),
    localGetAll('events'),
    localGetAll('expense_categories'),
  ]);

  const existingHabitTitles = new Set(
    (existingHabits as Array<{ title: string; is_deleted?: boolean }>)
      .filter(h => !h.is_deleted)
      .map(h => h.title.toLowerCase().trim()),
  );

  const existingCategoryNames = new Set(
    (existingCategories as Array<{ name: string }>)
      .map(c => c.name.toLowerCase().trim()),
  );

  const hasExistingGoals = (existingGoals as Array<{ is_deleted?: boolean }>)
    .some(g => !g.is_deleted);

  try {
    // ──────────────────────────────────────────────
    // 1. SEED HABITS (6 based on rhythm)
    // ──────────────────────────────────────────────
    const habitPresets = HABIT_PRESETS[onboardingAnswers.dailyRhythm] || HABIT_PRESETS['9-5'];

    for (const preset of habitPresets) {
      // Skip if a habit with this title already exists
      if (existingHabitTitles.has(preset.title.toLowerCase().trim())) continue;

      const success = useHabitsStore.getState().createHabit(userId, {
        title: preset.title,
        description: preset.description,
        icon: preset.icon,
        category: preset.category,
        frequency: preset.frequency as any,
        time_of_day: preset.timeOfDay,
        duration_minutes: preset.durationMinutes,
        is_active: true,
        isSeeded: true as any,  // Custom flag for seeded items
        streak_current: 0,
        streak_best: 0,
        target_count: 1,
        is_deleted: false,
      });

      if (await success) {
        result.habits++;
      }
    }

    // ──────────────────────────────────────────────
    // 2. SEED GOALS (3 from topGoals, each as Objective + 3 sub-goals)
    // ──────────────────────────────────────────────
    if (!hasExistingGoals && onboardingAnswers.topGoals?.length > 0) {
      const goalTitles = onboardingAnswers.topGoals.slice(0, 3);

      for (const goalTitle of goalTitles) {
        if (!goalTitle.trim()) continue;

        // Create the Objective (top-level goal)
        const objectiveId = genId();
        const createdObjectiveId = await useGoalsStore.getState().createGoal({
          id: objectiveId,
          user_id: userId,
          title: goalTitle.trim(),
          description: `Your objective: ${goalTitle.trim()}`,
          category: 'objective',
          status: 'active',
          parent_goal_id: null,
          is_deleted: false,
          sort_order: result.goals,
          isSeeded: true as any,
          created_at: new Date().toISOString(),
        });

        if (createdObjectiveId) {
          result.goals++;

          // Create 3 sub-goals under this objective
          const subGoalTemplates = generateSubGoals(goalTitle.trim());
          for (const sub of subGoalTemplates) {
            const subId = genId();
            const createdSubId = await useGoalsStore.getState().createGoal({
              id: subId,
              user_id: userId,
              title: sub.title,
              description: sub.description,
              category: 'goal',
              status: 'active',
              parent_goal_id: createdObjectiveId,
              is_deleted: false,
              sort_order: result.goals,
              isSeeded: true as any,
              created_at: new Date().toISOString(),
            });

            if (createdSubId) {
              result.goals++;
            }
          }
        }
      }
    }

    // ──────────────────────────────────────────────
    // 3. SEED SCHEDULE BLOCKS (based on dailyRhythm + wake/sleep)
    // ──────────────────────────────────────────────
    if (onboardingAnswers.wakeTime && onboardingAnswers.sleepTime) {
      const blocks = generateScheduleBlocks(
        onboardingAnswers.dailyRhythm,
        onboardingAnswers.wakeTime,
        onboardingAnswers.sleepTime,
      );

      // Get today's date for scheduling
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];

      for (const block of blocks) {
        const eventId = genId();
        const startISO = `${dateStr}T${block.startTime}:00`;
        const endISO = `${dateStr}T${block.endTime}:00`;

        await localInsert('events', {
          id: eventId,
          user_id: userId,
          title: block.title,
          description: `Suggested schedule block based on your ${onboardingAnswers.dailyRhythm} rhythm`,
          start_time: startISO,
          end_time: endISO,
          event_type: block.eventType,
          color: block.color,
          all_day: false,
          is_deleted: false,
          is_recurring: false,
          day_type: 'weekday',
          isSeeded: true as any,
          created_at: new Date().toISOString(),
        });

        result.events++;

        // Also push into the schedule store's local state (optimistic)
        useScheduleStore.setState(s => ({
          events: [...s.events, {
            id: eventId,
            user_id: userId,
            title: block.title,
            description: `Suggested schedule block based on your ${onboardingAnswers.dailyRhythm} rhythm`,
            start_time: startISO,
            end_time: endISO,
            event_type: block.eventType,
            color: block.color,
            all_day: false,
            is_deleted: false,
            is_recurring: false,
            day_type: 'weekday',
            isSeeded: true,
            created_at: new Date().toISOString(),
          }],
        }));
      }
    }

    // ──────────────────────────────────────────────
    // 4. SEED EXPENSE CATEGORIES (3 defaults)
    // ──────────────────────────────────────────────
    const defaultCategories: Array<{
      name: string;
      icon: string;   // lucide icon name, no emoji per DESIGN-RULES
      color: string;
      scope: string;
      sortOrder: number;
    }> = [
      { name: 'Groceries', icon: 'shopping-cart', color: '#4ECB71', scope: 'personal', sortOrder: 0 },
      { name: 'Transport', icon: 'car', color: '#00D4FF', scope: 'personal', sortOrder: 1 },
      { name: 'Subscriptions', icon: 'repeat', color: '#F97316', scope: 'personal', sortOrder: 2 },
    ];

    for (const cat of defaultCategories) {
      // Skip if a category with this name already exists
      if (existingCategoryNames.has(cat.name.toLowerCase().trim())) continue;

      await localInsert<ExpenseCategory>('expense_categories', {
        id: genId(),
        user_id: userId,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        scope: cat.scope,
        budget_monthly: null,
        sort_order: cat.sortOrder,
        isSeeded: true as any,
        created_at: new Date().toISOString(),
      });

      result.categories++;
    }

    // Push categories into finance store local state
    if (result.categories > 0) {
      useFinanceStore.getState().invalidate();
    }

    // ── Mark as seeded (idempotency) ──
    markSeeded(userId);

    logger.log(
      `[data-seed] Seeded ${result.habits} habits, ${result.goals} goals, ${result.events} events, ${result.categories} categories for user ${userId.slice(0, 8)}`,
    );

    // Trigger background sync to push seeded data to Supabase
    try {
      const { syncNow } = await import('./sync-engine');
      const effectiveUid = getEffectiveUserId();
      if (effectiveUid) {
        syncNow(effectiveUid).catch(() => {});
      }
    } catch { /* sync is best-effort */ }

  } catch (err) {
    logger.error('[data-seed] Seeding failed:', err);
    // Don't mark as seeded so it can be retried
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// SUB-GOAL GENERATOR — creates 3 meaningful sub-goals for a top goal
// ═══════════════════════════════════════════════════════════════

interface SubGoalTemplate {
  title: string;
  description: string;
}

function generateSubGoals(parentTitle: string): SubGoalTemplate[] {
  const lower = parentTitle.toLowerCase();

  // Domain-specific sub-goal templates
  if (lower.includes('fitness') || lower.includes('health') || lower.includes('exercise') || lower.includes('weight')) {
    return [
      { title: `Set up ${parentTitle} routine`, description: `Establish a consistent schedule for ${parentTitle.toLowerCase()}` },
      { title: `Track progress for ${parentTitle}`, description: `Choose metrics and track them weekly` },
      { title: `Reach first milestone in ${parentTitle}`, description: `Define and hit your initial target` },
    ];
  }

  if (lower.includes('learn') || lower.includes('study') || lower.includes('course') || lower.includes('skill') || lower.includes('education')) {
    return [
      { title: `Gather resources for ${parentTitle}`, description: `Find courses, books, or tutorials` },
      { title: `Complete first module of ${parentTitle}`, description: `Finish the introductory section` },
      { title: `Practice and apply ${parentTitle}`, description: `Build a project or practice exercise` },
    ];
  }

  if (lower.includes('save') || lower.includes('budget') || lower.includes('money') || lower.includes('finance') || lower.includes('debt')) {
    return [
      { title: `Audit current state for ${parentTitle}`, description: `Review where you stand today` },
      { title: `Create plan for ${parentTitle}`, description: `Set monthly targets and action steps` },
      { title: `Hit first savings target for ${parentTitle}`, description: `Reach your initial milestone` },
    ];
  }

  if (lower.includes('business') || lower.includes('startup') || lower.includes('company') || lower.includes('freelance')) {
    return [
      { title: `Define strategy for ${parentTitle}`, description: `Clarify your offer, audience, and plan` },
      { title: `Launch first version of ${parentTitle}`, description: `Get your MVP or offer live` },
      { title: `Get first customer for ${parentTitle}`, description: `Validate with a real paying client` },
    ];
  }

  if (lower.includes('read') || lower.includes('book')) {
    return [
      { title: `Build reading list for ${parentTitle}`, description: `Select books and set a reading order` },
      { title: `Complete first book for ${parentTitle}`, description: `Finish and take notes on your first selection` },
      { title: `Apply insights from ${parentTitle}`, description: `Implement one key takeaway` },
    ];
  }

  // Generic sub-goals for any goal
  return [
    { title: `Research and plan ${parentTitle}`, description: `Understand what it takes and create a plan` },
    { title: `Take first action on ${parentTitle}`, description: `Start with the smallest meaningful step` },
    { title: `Build consistency with ${parentTitle}`, description: `Establish a weekly rhythm toward this goal` },
  ];
}

// ═══════════════════════════════════════════════════════════════
// UTILITY: Clear seed marker (for testing or re-onboarding)
// ═══════════════════════════════════════════════════════════════

/**
 * Clear the seed marker for a given user, allowing re-seeding.
 * Useful for testing or if a user wants to re-do onboarding.
 */
export function clearSeedMarker(userId: string): void {
  try {
    const stored = localStorage.getItem(SEED_MARKER_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      delete parsed[userId];
      localStorage.setItem(SEED_MARKER_KEY, JSON.stringify(parsed));
    }
  } catch { /* ignore */ }
}

/**
 * Check if a user has been seeded already (public API for UI).
 */
export function checkIfSeeded(userId: string): boolean {
  return isAlreadySeeded(userId);
}