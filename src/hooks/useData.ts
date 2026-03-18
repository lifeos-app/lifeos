import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

export function useQuery<T>(table: string, options?: {
  column?: string;
  value?: string;
  orderBy?: string;
  ascending?: boolean;
  filter?: Record<string, unknown>;
}) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let query = supabase.from(table).select('*').eq('is_deleted', false);
      if (options?.column && options?.value) {
        query = query.eq(options.column, options.value);
      }
      if (options?.filter) {
        for (const [k, v] of Object.entries(options.filter)) {
          query = query.eq(k, v);
        }
      }
      if (options?.orderBy) {
        query = query.order(options.orderBy, { ascending: options.ascending ?? true });
      }
      const { data: rows, error } = await query;
      if (!cancelled) {
        if (error) logger.error(`[useQuery] ${table}:`, error.message);
        setData((rows as T[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [table, tick, options?.column, options?.value, options?.orderBy]);

  return { data, loading, refresh };
}

export function useTodayEvents() {
  return useQuery<any>('schedule_events', {
    orderBy: 'start_time',
    ascending: true,
  });
}

export function useTasks() {
  return useQuery<any>('tasks', { orderBy: 'created_at', ascending: false });
}

export function useGoals() {
  return useQuery<any>('goals', { orderBy: 'sort_order', ascending: true });
}

export function useHabits() {
  return useQuery<any>('habits', {
    filter: { is_active: true },
    orderBy: 'created_at',
  });
}

export function useClients() {
  return useQuery<any>('clients', {
    filter: { is_active: true },
    orderBy: 'name',
  });
}
