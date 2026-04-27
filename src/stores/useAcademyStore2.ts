/**
 * Academy Store 2.0 — Zustand
 *
 * Manages learning goals, curricula, assessments, and study sessions
 * for the adaptive Academy 2.0 system.
 */

import { create } from 'zustand';
import { localGetAll, localInsert, localUpdate, getEffectiveUserId } from '../lib/local-db';
import { syncNow } from '../lib/sync-engine';
import { isOnline } from '../lib/offline';
import { useUserStore } from './useUserStore';
import { generateCurriculum } from '../lib/curriculum-engine';
import { awardXP } from '../lib/gamification/xp-engine';
import { genId } from '../utils/date';
import { logger } from '../utils/logger';
import type {
  LearningGoal,
  Assessment,
  StudySession2,
  LearnerProfile,
  WizardInput,
  CurriculumLesson,
} from '../types/academy';

// ── Types ──

interface AcademyStore2State {
  activeLearningGoals: LearningGoal[];
  assessments: Assessment[];
  studySessions: StudySession2[];
  learnerProfile: LearnerProfile | null;
  loading: boolean;
  generatingCurriculum: boolean;
  lastFetched: number | null;
}

interface AcademyStore2Actions {
  fetchAll: () => Promise<void>;
  createLearningGoal: (input: WizardInput) => Promise<string | null>;
  completeLesson: (learningGoalId: string, lessonId: string) => Promise<void>;
  getGoalById: (id: string) => LearningGoal | undefined;
  getCompletedLessonIds: (goalId: string) => string[];
  getTodaysLesson: (date: string) => { goal: LearningGoal; lesson: CurriculumLesson } | null;
}

// ── Constants ──

const STALE_MS = 2 * 60 * 1000;

// ── Store ──

export const useAcademyStore2 = create<AcademyStore2State & AcademyStore2Actions>((set, get) => ({
  // Initial state
  activeLearningGoals: [],
  assessments: [],
  studySessions: [],
  learnerProfile: null,
  loading: false,
  generatingCurriculum: false,
  lastFetched: null,

  fetchAll: async () => {
    const { lastFetched, loading } = get();
    if (loading) return;
    if (lastFetched && Date.now() - lastFetched < STALE_MS) return;

    set({ loading: true });

    try {
      const [goals, assessments] = await Promise.all([
        localGetAll<LearningGoal>('learning_goals'),
        localGetAll<Assessment>('academy_assessments'),
      ]);

      const filteredGoals = goals.filter(g => !g.is_deleted);
      const filteredAssessments = assessments.filter((a: Assessment & { is_deleted?: boolean }) => !(a as { is_deleted?: boolean }).is_deleted);

      set({
        activeLearningGoals: filteredGoals,
        assessments: filteredAssessments,
        loading: false,
        lastFetched: Date.now(),
      });

      // Background sync if online
      if (isOnline()) {
        try {
          const { data: { session } } = await useUserStore.getState().getSessionCached();
          if (session?.user) {
            syncNow(session.user.id).catch(e => logger.warn('[academy2] sync failed:', e));
          }
        } catch {
          // Not authenticated — skip sync
        }
      }
    } catch (err) {
      logger.error('[academy2] Failed to load from local DB:', err);
      set({ loading: false });
    }
  },

  createLearningGoal: async (input: WizardInput) => {
    set({ generatingCurriculum: true });

    try {
      const curriculum = await generateCurriculum(input);
      const userId = getEffectiveUserId();
      const now = new Date().toISOString();

      const goal: LearningGoal = {
        id: genId(),
        userId,
        topic: input.topic,
        domain: input.domain,
        currentLevel: input.currentLevel,
        targetDescription: input.targetDescription,
        minutesPerDay: input.minutesPerDay,
        targetDate: input.targetDate,
        learningStyle: input.learningStyle,
        status: 'active',
        curriculum,
        currentPhaseIndex: 0,
        currentLessonId: curriculum.phases[0]?.topics[0]?.lessons[0]?.id ?? null,
        habitId: null,
        parentGoalId: null,
        pacingStatus: 'on_track',
        lessonsCompletedThisWeek: 0,
        lessonsScheduledThisWeek: 0,
        weeklyTargetLessons: Math.max(1, Math.round((input.minutesPerDay * 7) / 30)),
        lastPacingEvalDate: null,
        createdAt: now,
        updatedAt: now,
        is_deleted: false,
      };

      await localInsert('learning_goals', {
        ...goal,
        user_id: userId,
      });

      // Optimistic update
      set({
        activeLearningGoals: [...get().activeLearningGoals, goal],
        generatingCurriculum: false,
      });

      // Background sync
      if (isOnline()) {
        try {
          const { data: { session } } = await useUserStore.getState().getSessionCached();
          if (session?.user) {
            syncNow(session.user.id).catch(e => logger.warn('[academy2] sync failed:', e));
          }
        } catch {
          // Not authenticated
        }
      }

      return goal.id;
    } catch (err) {
      logger.error('[academy2] Failed to create learning goal:', err);
      set({ generatingCurriculum: false });
      return null;
    }
  },

  completeLesson: async (learningGoalId: string, lessonId: string) => {
    const { activeLearningGoals } = get();
    const goal = activeLearningGoals.find(g => g.id === learningGoalId);
    if (!goal || !goal.curriculum) return;

    const now = new Date().toISOString();
    const userId = getEffectiveUserId();

    // Deep clone the curriculum to avoid mutating state directly
    const updatedCurriculum = JSON.parse(JSON.stringify(goal.curriculum));
    let lessonTitle = '';
    let phaseCompleted = false;
    let completedPhaseIndex = -1;

    // Find and mark the lesson as completed
    for (const phase of updatedCurriculum.phases) {
      for (const topic of phase.topics) {
        for (const lesson of topic.lessons) {
          if (lesson.id === lessonId && !lesson.completedAt) {
            lesson.completedAt = now;
            lessonTitle = lesson.title;
          }
        }
      }
    }

    // Check if any phase is now fully complete
    for (let pi = 0; pi < updatedCurriculum.phases.length; pi++) {
      const phase = updatedCurriculum.phases[pi];
      const allLessons = phase.topics.flatMap((t: { lessons: CurriculumLesson[] }) => t.lessons);
      const allComplete = allLessons.every((l: CurriculumLesson) => l.completedAt !== null);

      if (allComplete && !phase.completedAt) {
        phase.completedAt = now;
        phase.assessmentStatus = 'available';
        phaseCompleted = true;
        completedPhaseIndex = pi;
      }
    }

    // Build updated goal
    const updatedGoal: LearningGoal = {
      ...goal,
      curriculum: updatedCurriculum,
      lessonsCompletedThisWeek: goal.lessonsCompletedThisWeek + 1,
      updatedAt: now,
    };

    // If phase completed, advance currentPhaseIndex
    if (phaseCompleted && completedPhaseIndex >= 0 && completedPhaseIndex === goal.currentPhaseIndex) {
      const nextPhase = completedPhaseIndex + 1;
      if (nextPhase < updatedCurriculum.phases.length) {
        updatedGoal.currentPhaseIndex = nextPhase;
        updatedGoal.currentLessonId = updatedCurriculum.phases[nextPhase]?.topics[0]?.lessons[0]?.id ?? null;
      }
    }

    // Check if all phases are complete
    const allPhasesComplete = updatedCurriculum.phases.every((p: { completedAt: string | null }) => p.completedAt !== null);
    if (allPhasesComplete) {
      updatedGoal.status = 'completed';
    }

    // Persist
    await localUpdate('learning_goals', learningGoalId, {
      curriculum: updatedCurriculum,
      lessonsCompletedThisWeek: updatedGoal.lessonsCompletedThisWeek,
      currentPhaseIndex: updatedGoal.currentPhaseIndex,
      currentLessonId: updatedGoal.currentLessonId,
      status: updatedGoal.status,
      updatedAt: now,
    });

    // Optimistic update
    set({
      activeLearningGoals: activeLearningGoals.map(g =>
        g.id === learningGoalId ? updatedGoal : g
      ),
    });

    // Award XP
    try {
      await awardXP(null, userId, 'academy_lesson_complete', {
        description: lessonTitle || 'Academy lesson completed',
      });

      if (phaseCompleted) {
        await awardXP(null, userId, 'academy_phase_complete', {
          description: `Phase ${completedPhaseIndex + 1} completed`,
        });
      }
    } catch (err) {
      logger.warn('[academy2] XP award failed:', err);
    }

    // Background sync
    if (isOnline()) {
      try {
        const { data: { session } } = await useUserStore.getState().getSessionCached();
        if (session?.user) {
          syncNow(session.user.id).catch(e => logger.warn('[academy2] sync failed:', e));
        }
      } catch {
        // Not authenticated
      }
    }
  },

  getGoalById: (id: string) => {
    return get().activeLearningGoals.find(g => g.id === id);
  },

  getCompletedLessonIds: (goalId: string) => {
    const goal = get().activeLearningGoals.find(g => g.id === goalId);
    if (!goal?.curriculum) return [];

    const ids: string[] = [];
    for (const phase of goal.curriculum.phases) {
      for (const topic of phase.topics) {
        for (const lesson of topic.lessons) {
          if (lesson.completedAt) ids.push(lesson.id);
        }
      }
    }
    return ids;
  },

  getTodaysLesson: (_date: string) => {
    const goals = get().activeLearningGoals.filter(g => g.status === 'active');
    for (const goal of goals) {
      if (!goal.curriculum) continue;
      for (const phase of goal.curriculum.phases) {
        for (const topic of phase.topics) {
          for (const lesson of topic.lessons) {
            if (!lesson.completedAt) {
              return { goal, lesson };
            }
          }
        }
      }
    }
    return null;
  },
}));
