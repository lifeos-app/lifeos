import { useHealthStore } from '../../stores/useHealthStore';
import { localQuery, localInsert, localUpdate, getEffectiveUserId } from '../local-db';
import { localDateStr, genId } from '../../utils/date';
import type { HealthMetric } from '../../types/database';

// Private helper: upsert today's health_metrics row
async function upsertToday(updates: Partial<HealthMetric>): Promise<void> {
  const today = localDateStr();
  const rows = await localQuery<HealthMetric>('health_metrics', 'date', today);
  if (rows.length > 0) {
    await localUpdate('health_metrics', rows[0].id, { ...updates, updated_at: new Date().toISOString() });
  } else {
    await localInsert('health_metrics', {
      id: genId(),
      user_id: getEffectiveUserId(),
      date: today,
      ...updates,
    });
  }
  useHealthStore.getState().invalidate();
}

export const HealthService = {
  today(): HealthMetric | null {
    return useHealthStore.getState().todayMetrics;
  },
  logMood(score: number): Promise<void> {
    return upsertToday({ mood_score: score });
  },
  logExercise(minutes: number): Promise<void> {
    return upsertToday({ exercise_minutes: minutes });
  },
  logSleep(hours: number): Promise<void> {
    return upsertToday({ sleep_hours: hours });
  },
  stats() {
    const m = useHealthStore.getState().todayMetrics;
    return {
      mood: m?.mood_score ?? null,
      energy: m?.energy_score ?? null,
      sleep: m?.sleep_hours ?? null,
      exercise: m?.exercise_minutes ?? null,
      water: m?.water_glasses ?? null,
    };
  },
};
