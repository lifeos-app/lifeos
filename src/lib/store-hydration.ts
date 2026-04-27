/**
 * Store Hydration DAG
 *
 * Orchestrates startup hydration of all 16 Zustand stores in dependency order.
 * Each phase waits for the previous one to settle before starting.
 * After all phases complete, fires a single syncNowImmediate to reconcile.
 */

import { logger } from '../utils/logger';
import { syncNowImmediate } from './sync-engine';

// ── Store imports ──
import { useUserStore } from '../stores/useUserStore';
import { useCharacterAppearanceStore } from '../stores/useCharacterAppearanceStore';
import { useAssetsStore } from '../stores/useAssetsStore';
import { useHealthStore } from '../stores/useHealthStore';
import { useHabitsStore } from '../stores/useHabitsStore';
import { useFinanceStore } from '../stores/useFinanceStore';
import { useGoalsStore } from '../stores/useGoalsStore';
import { useScheduleStore } from '../stores/useScheduleStore';
import { useJournalStore } from '../stores/useJournalStore';
import { useLiveActivityStore } from '../stores/useLiveActivityStore';
import { useAgentStore } from '../stores/useAgentStore';
import { useInventoryStore } from '../stores/useInventoryStore';
import { usePartsStore } from '../stores/usePartsStore';
import { useAcademyStore } from '../stores/useAcademyStore';
import { useAcademyStore2 } from '../stores/useAcademyStore2';
import { useLessonsStore } from '../stores/useLessonsStore';

// ── Hydration state tracking ──
export interface HydrationState {
  phase: number;
  completed: string[];
  errors: string[];
}

let hydrationState: HydrationState = { phase: 0, completed: [], errors: [] };

export function getHydrationState(): Readonly<HydrationState> {
  return hydrationState;
}

// ── Phase definitions ──
// Each entry: [storeName, hydrateFn]
const skipSync = { skipSync: true };

function getPhases(userId: string): Array<Array<[string, () => Promise<unknown>]>> {
  return [
    // Phase 1 — core, no deps
    // useUserStore.initAuth() already ran earlier; we record it as hydrated for DAG completeness
    [
      ['useUserStore', () => Promise.resolve()],
      ['useCharacterAppearanceStore', () => useCharacterAppearanceStore.getState().loadFromSupabase(userId)],
      ['useAssetsStore', () => useAssetsStore.getState().fetchAll(skipSync)],
    ],

    // Phase 2 — depends on user being authenticated
    [
      ['useHealthStore', () => useHealthStore.getState().fetchToday(skipSync)],
      ['useHabitsStore', () => useHabitsStore.getState().fetchAll(skipSync)],
      ['useFinanceStore', () => useFinanceStore.getState().fetchAll(skipSync)],
      ['useGoalsStore', () => useGoalsStore.getState().fetchAll(skipSync)],
      ['useScheduleStore', () => useScheduleStore.getState().fetchAll(skipSync)],
      ['useJournalStore', () => useJournalStore.getState().fetchRecent(50, skipSync)],
    ],

    // Phase 3 — depends on phase 2 data
    [
      ['useLiveActivityStore', () => useLiveActivityStore.getState().hydrate()],
      ['useAgentStore', () => Promise.all([
        useAgentStore.getState().fetchNudges(userId),
        useAgentStore.getState().fetchPersistedInsights(userId),
      ])],
      ['useInventoryStore', () => useInventoryStore.getState().fetchAll()],
      ['usePartsStore', () => usePartsStore.getState().fetchAll()],
    ],

    // Phase 4 — lazy, defer further (no skipSync — these fire their own syncs)
    [
      ['useAcademyStore', () => Promise.resolve(useAcademyStore.getState().hydrate())],
      ['useAcademyStore2', () => useAcademyStore2.getState().fetchAll()],
      ['useLessonsStore', () => useLessonsStore.getState().fetchAll()],
    ],
  ];
}

/**
 * Run all hydration phases sequentially, then fire syncNowImmediate.
 * Returns the final hydration state.
 */
export async function hydrateStores(userId: string): Promise<HydrationState> {
  hydrationState = { phase: 0, completed: [], errors: [] };
  const phases = getPhases(userId);
  const totalStores = phases.reduce((sum, p) => sum + p.length, 0);

  logger.info(`[hydration] starting ${phases.length} phases, ${totalStores} stores for user ${userId}`);

  for (let phaseIdx = 0; phaseIdx < phases.length; phaseIdx++) {
    hydrationState.phase = phaseIdx + 1;
    const phase = phases[phaseIdx];
    logger.info(`[hydration] phase ${phaseIdx + 1}: ${phase.map(([name]) => name).join(', ')}`);

    const results = await Promise.allSettled(phase.map(([name, fn]) => fn().then(() => name)));

    for (const result of results) {
      if (result.status === 'fulfilled') {
        hydrationState.completed.push(result.value);
      } else {
        const storeName = phase[results.indexOf(result)]?.[0] ?? 'unknown';
        hydrationState.errors.push(storeName);
        logger.warn(`[hydration] ${storeName} failed: ${result.reason}`);
      }
    }

    logger.info(
      `[hydration] phase ${phaseIdx + 1} done — ` +
      `${hydrationState.completed.length}/${totalStores} completed, ` +
      `${hydrationState.errors.length} errors`
    );

    // Small inter-phase yield so UI stays responsive
    await new Promise<void>(r => setTimeout(r, 0));
  }

  logger.info(
    `[hydration] all phases complete — ` +
    `${hydrationState.completed.length} succeeded, ${hydrationState.errors.length} failed`
  );

  // After all phases, fire a single sync
  try {
    await syncNowImmediate(userId);
    logger.info('[hydration] post-hydration sync complete');
  } catch (e) {
    logger.warn('[hydration] post-hydration sync failed:', e);
  }

  return hydrationState;
}