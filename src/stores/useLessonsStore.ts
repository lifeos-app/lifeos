/**
 * useLessonsStore — Zustand store for Teddy's Lessons progress.
 *
 * Tracks per-lesson completion state with steps_completed JSON arrays.
 * Follows the same pattern as useHabitsStore for CRUD + sync.
 */

import { create } from 'zustand';
import { genId } from '../utils/date';
import { localGetAll, localInsert, localUpdate, type TableName } from '../lib/local-db';
import { logger } from '../utils/logger';

const TABLE: TableName = 'lesson_progress';

export interface LessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  module_id: string;
  status: 'not_started' | 'in_progress' | 'completed';
  current_step: string | null;
  steps_completed: string[];
  score: number;
  streak_current: number;
  streak_best: number;
  total_practice_time: number;
  last_practiced_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: number;
  sync_status: string;
}

interface LessonsState {
  progress: LessonProgress[];
  loading: boolean;
  lastFetched: number | null;

  fetchAll: () => Promise<void>;
  completeStep: (lessonId: string, stepId: string) => Promise<void>;
  getProgress: (lessonId: string) => LessonProgress | undefined;
  getCompletedSteps: (lessonId: string) => string[];
}

const STALE_MS = 2 * 60 * 1000; // 2 minutes

export const useLessonsStore = create<LessonsState>((set, get) => ({
  progress: [],
  loading: false,
  lastFetched: null,

  fetchAll: async () => {
    const { lastFetched, loading } = get();
    if (loading) return;
    if (lastFetched && Date.now() - lastFetched < STALE_MS) return;

    set({ loading: true });
    try {
      const rows = await localGetAll<LessonProgress>(TABLE);
      const active = rows.filter(r => !r.is_deleted);
      // Parse steps_completed if stored as string
      const parsed = active.map(r => ({
        ...r,
        steps_completed: typeof r.steps_completed === 'string'
          ? JSON.parse(r.steps_completed)
          : (r.steps_completed || []),
      }));
      set({ progress: parsed, lastFetched: Date.now() });
    } catch (e) {
      logger.error('[lessons] fetchAll failed:', e);
    } finally {
      set({ loading: false });
    }
  },

  completeStep: async (lessonId: string, stepId: string) => {
    const { progress } = get();
    let existing = progress.find(p => p.lesson_id === lessonId);

    if (!existing) {
      // Create new progress record
      const now = new Date().toISOString();
      const newProgress: Partial<LessonProgress> = {
        id: genId(),
        lesson_id: lessonId,
        module_id: 'teddys-lessons',
        status: 'in_progress',
        current_step: stepId,
        steps_completed: [stepId],
        score: 10,
        streak_current: 1,
        streak_best: 1,
        total_practice_time: 0,
        last_practiced_at: now,
        completed_at: null,
        is_deleted: 0,
        sync_status: 'pending',
      };

      try {
        const inserted = await localInsert(TABLE, newProgress as any);
        // Parse the inserted record
        const record: LessonProgress = {
          ...inserted,
          steps_completed: typeof inserted.steps_completed === 'string'
            ? JSON.parse(inserted.steps_completed)
            : (inserted.steps_completed || []),
        };
        set({ progress: [...progress, record] });
      } catch (e) {
        logger.error('[lessons] completeStep insert failed:', e);
      }
      return;
    }

    // Update existing record
    const stepsCompleted = Array.isArray(existing.steps_completed)
      ? existing.steps_completed
      : [];

    if (stepsCompleted.includes(stepId)) return; // Already completed

    const updatedSteps = [...stepsCompleted, stepId];
    const now = new Date().toISOString();

    const updates: Partial<LessonProgress> = {
      steps_completed: updatedSteps,
      current_step: stepId,
      score: (existing.score || 0) + 10,
      last_practiced_at: now,
      status: 'in_progress',
    };

    try {
      await localUpdate(TABLE, existing.id, updates as any);

      // Update in-memory state
      set({
        progress: progress.map(p =>
          p.id === existing!.id
            ? { ...p, ...updates, steps_completed: updatedSteps }
            : p
        ),
      });
    } catch (e) {
      logger.error('[lessons] completeStep update failed:', e);
    }
  },

  getProgress: (lessonId: string) => {
    return get().progress.find(p => p.lesson_id === lessonId);
  },

  getCompletedSteps: (lessonId: string) => {
    const p = get().progress.find(p => p.lesson_id === lessonId);
    if (!p) return [];
    return Array.isArray(p.steps_completed) ? p.steps_completed : [];
  },
}));
