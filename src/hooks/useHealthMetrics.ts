// ═══════════════════════════════════════════════════════════
// Health Metrics Hook — daily metrics (mood, energy, water, sleep, weight)
// ═══════════════════════════════════════════════════════════
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useHealthStore } from '../stores/useHealthStore';
import { logger } from '../utils/logger';
import type { HealthMetrics } from './useHealthTypes';

export function useHealthMetrics(dateRange?: { from: string; to: string }) {
  const [data, setData] = useState<HealthMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let query = supabase.from('health_metrics').select('*').eq('is_deleted', false).order('date', { ascending: false });
      if (dateRange) {
        query = query.gte('date', dateRange.from).lte('date', dateRange.to);
      } else {
        query = query.limit(30);
      }
      const { data: rows, error } = await query;
      if (!cancelled) {
        if (error) logger.error('[useHealthMetrics]', error.message);
        setData((rows as HealthMetrics[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tick, dateRange?.from, dateRange?.to]);

  const upsertToday = async (metrics: Partial<HealthMetrics>) => {
    const today = new Date().toISOString().split('T')[0];
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;

    const { error } = await supabase.from('health_metrics').upsert({
      user_id: user.user.id,
      date: today,
      ...metrics,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date' });

    if (error) logger.error('[upsertToday]', error.message);
    else refresh();
  };

  return { data, loading, refresh, upsertToday };
}

// ═══════════════════════════════════════════════════════════
// Dashboard Health Summary (for Today page widget)
// ═══════════════════════════════════════════════════════════
interface HealthSummary {
  metrics: HealthMetrics | null;
  workouts: Record<string, unknown>[];
  meditations: Record<string, unknown>[];
  gratitude: Record<string, unknown>[];
  workoutsDone: number;
  meditationMins: number;
  gratitudeCount: number;
}

export function useHealthSummary() {
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const todayMetrics = useHealthStore(s => s.todayMetrics);

  useEffect(() => {
    // Ensure health store is hydrated
    useHealthStore.getState().fetchToday();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const today = new Date().toISOString().split('T')[0];

      // Health metrics come from the store (already cached).
      // Exercise logs, meditation, gratitude still need direct queries (no store for those yet).
      const [workoutsRes, meditationRes, gratitudeRes] = await Promise.all([
        supabase.from('exercise_logs').select('*, workout_templates(name, icon)').eq('date', today).eq('is_deleted', false),
        supabase.from('meditation_logs').select('*').eq('date', today).eq('is_deleted', false),
        supabase.from('gratitude_entries').select('*').eq('date', today).eq('is_deleted', false),
      ]);

      if (!cancelled) {
        const workouts = workoutsRes.data || [];
        const meditations = meditationRes.data || [];
        const gratitude = gratitudeRes.data || [];
        setSummary({
          metrics: todayMetrics as HealthMetrics | null,
          workouts,
          meditations,
          gratitude,
          workoutsDone: workouts.filter((w: Record<string, unknown>) => w.completed).length,
          meditationMins: meditations.reduce((s: number, m: Record<string, unknown>) => s + (Number(m.duration_min) || 0), 0),
          gratitudeCount: gratitude.length,
        });
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { summary, loading };
}
