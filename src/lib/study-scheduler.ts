/**
 * study-scheduler.ts — Study Scheduling Integration for Academy 2.0
 *
 * Creates schedule tasks, study habits, and goals hierarchy
 * by integrating with existing LifeOS stores.
 */

import { useScheduleStore } from '../stores/useScheduleStore';
import { useHabitsStore } from '../stores/useHabitsStore';
import { useGoalsStore } from '../stores/useGoalsStore';
import { logger } from '../utils/logger';

// ── Types (inline) ──

interface CurriculumLesson {
  id: string;
  title: string;
  estimatedMinutes: number;
  keyPoints: string[];
  content: string;
  completedAt: string | null;
  scheduledDate: string | null;
}

interface CurriculumPhase {
  id: string;
  title: string;
  milestoneDescription: string;
  topics: { lessons: CurriculumLesson[] }[];
  assessmentStatus: string;
  completedAt: string | null;
  goalId: string | null;
}

interface LearningGoal {
  id: string;
  userId: string;
  topic: string;
  domain: string;
  curriculum: { phases: CurriculumPhase[] } | null;
  weeklyTargetLessons: number;
  lessonsCompletedThisWeek: number;
  lessonsScheduledThisWeek: number;
  lastPacingEvalDate: string | null;
  pacingStatus: string;
  habitId: string | null;
  parentGoalId: string | null;
  currentPhaseIndex: number;
  currentLessonId: string | null;
  minutesPerDay: number;
  targetDate: string | null;
  [key: string]: unknown;
}

// ── Helpers ──

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getAllLessons(goal: LearningGoal): CurriculumLesson[] {
  if (!goal.curriculum?.phases) return [];
  const lessons: CurriculumLesson[] = [];
  for (const phase of goal.curriculum.phases) {
    for (const topic of phase.topics) {
      for (const lesson of topic.lessons) {
        lessons.push(lesson);
      }
    }
  }
  return lessons;
}

// ── Public API ──

/**
 * Schedule the next incomplete lesson as a task.
 * Returns the scheduled date string, or null if no lessons remain.
 */
export async function scheduleNextLesson(
  userId: string,
  goal: LearningGoal,
): Promise<string | null> {
  const lessons = getAllLessons(goal);
  const nextLesson = lessons.find(l => l.completedAt === null);
  if (!nextLesson) return null;

  // Calculate spacing based on weekly target
  // e.g. 3/week = every ~2.3 days, 5/week = every ~1.4 days
  const weeklyTarget = Math.max(goal.weeklyTargetLessons, 1);
  const daysBetween = Math.max(Math.round(7 / weeklyTarget), 1);

  // Find the last scheduled date or use today
  const scheduledLessons = lessons.filter(l => l.scheduledDate);
  const lastScheduled = scheduledLessons.length > 0
    ? scheduledLessons.sort((a, b) => (b.scheduledDate || '').localeCompare(a.scheduledDate || ''))[0].scheduledDate
    : null;

  const baseDate = lastScheduled ? new Date(lastScheduled + 'T00:00:00') : new Date();
  const schedDate = dateStr(addDays(baseDate, daysBetween));

  try {
    const createTask = useScheduleStore.getState().createTask;
    await createTask(userId, `Study: ${nextLesson.title}`, 'medium', {
      due_date: schedDate,
      scheduled_date: schedDate,
      domain: goal.domain || 'learning',
      tags: ['academy', goal.topic],
      estimated_duration: nextLesson.estimatedMinutes,
      source: 'onboarding_ai' as const,
    });

    // Update the lesson's scheduledDate in the curriculum
    nextLesson.scheduledDate = schedDate;

    return schedDate;
  } catch (err) {
    logger.error('[study-scheduler] Failed to schedule lesson:', err);
    return null;
  }
}

/**
 * Create a study habit linked to a learning goal.
 * Returns the habit ID or null on failure.
 */
export async function createStudyHabit(
  userId: string,
  topic: string,
  minutesPerDay: number,
  learningGoalId: string,
): Promise<string | null> {
  try {
    const createHabit = useHabitsStore.getState().createHabit;
    const success = await createHabit(userId, {
      title: `Study ${topic}`,
      icon: 'book-open',
      frequency: 'daily',
      target_count: 1,
      category: 'learning',
      duration_minutes: minutesPerDay,
      goal_id: learningGoalId,
      description: `Daily study session for ${topic} (Academy 2.0)`,
    });

    if (!success) return null;

    // Find the newly created habit by title match (most recent)
    const habits = useHabitsStore.getState().habits;
    const created = habits
      .filter(h => h.title === `Study ${topic}`)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      [0];

    return created?.id ?? null;
  } catch (err) {
    logger.error('[study-scheduler] Failed to create study habit:', err);
    return null;
  }
}

/**
 * Create a parent Goal (objective) plus child Goals for each phase.
 * Returns the parent goal ID or null on failure.
 */
export async function createLearningGoalInGoals(
  userId: string,
  topic: string,
  phases: CurriculumPhase[],
  targetDate: string | null,
): Promise<string | null> {
  try {
    const createGoal = useGoalsStore.getState().createGoal;

    // Create parent objective
    const parentId = await createGoal({
      user_id: userId,
      title: `Learn ${topic}`,
      description: `Academy 2.0 learning goal: master ${topic} through structured curriculum`,
      status: 'active',
      domain: 'learning',
      category: 'objective',
      target_date: targetDate,
      progress: 0,
      source: 'onboarding_ai' as const,
    });

    if (!parentId) return null;

    // Create child goals for each phase
    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      await createGoal({
        user_id: userId,
        title: `Phase ${i + 1}: ${phase.title}`,
        description: phase.milestoneDescription,
        status: 'active',
        domain: 'learning',
        category: 'goal',
        parent_goal_id: parentId,
        progress: 0,
        source: 'onboarding_ai' as const,
      });
    }

    return parentId;
  } catch (err) {
    logger.error('[study-scheduler] Failed to create learning goals:', err);
    return null;
  }
}

/**
 * Reschedule missed (past, unfinished) lessons to future dates.
 */
export async function rescheduleMissedLessons(
  userId: string,
  goal: LearningGoal,
): Promise<void> {
  const today = dateStr(new Date());
  const lessons = getAllLessons(goal);
  const missed = lessons.filter(
    l => l.scheduledDate && l.scheduledDate < today && l.completedAt === null,
  );

  if (missed.length === 0) return;

  const weeklyTarget = Math.max(goal.weeklyTargetLessons, 1);
  const spacing = Math.max(Math.round(7 / weeklyTarget), 1);

  let nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + 1); // start from tomorrow

  for (const lesson of missed) {
    const schedDate = dateStr(nextDate);

    try {
      const createTask = useScheduleStore.getState().createTask;
      await createTask(userId, `Study: ${lesson.title} (rescheduled)`, 'medium', {
        due_date: schedDate,
        scheduled_date: schedDate,
        domain: goal.domain || 'learning',
        tags: ['academy', goal.topic, 'rescheduled'],
        estimated_duration: lesson.estimatedMinutes,
        source: 'onboarding_ai' as const,
      });

      lesson.scheduledDate = schedDate;
    } catch (err) {
      logger.error('[study-scheduler] Failed to reschedule lesson:', err);
    }

    nextDate = addDays(nextDate, spacing);
  }
}

/**
 * Cancel future study tasks for a learning goal.
 * Soft-deletes tasks with matching tags.
 */
export async function cancelFutureStudyTasks(
  userId: string,
  _learningGoalId: string,
): Promise<void> {
  const today = dateStr(new Date());
  const tasks = useScheduleStore.getState().tasks;
  const deleteTask = useScheduleStore.getState().deleteTask;

  const futureTasks = tasks.filter(t => {
    if (t.user_id !== userId) return false;
    if (!t.due_date || t.due_date <= today) return false;
    if (t.status === 'done') return false;
    // Match by tags or title pattern
    const tags = t.tags ?? [];
    return tags.includes('academy') && t.title?.startsWith('Study:');
  });

  for (const task of futureTasks) {
    try {
      await deleteTask(task.id);
    } catch (err) {
      logger.error('[study-scheduler] Failed to cancel task:', err);
    }
  }
}
