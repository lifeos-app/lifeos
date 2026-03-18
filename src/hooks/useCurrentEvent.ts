// ═══════════════════════════════════════════════════════════
// useCurrentEvent — Time-Aware Schedule Hook
// Loads today's events from Supabase, tracks what's happening NOW
// Updates every minute
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/useUserStore';

export interface ScheduleEvent {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  start_time: string; // ISO datetime
  end_time: string;   // ISO datetime
  color?: string;
  category?: string;
  event_type?: string;
  day_type?: string;
  is_deleted?: boolean;
  completed?: boolean;
  workout_template_id?: string;
}

export interface CurrentEventState {
  currentEvent: ScheduleEvent | null;
  nextEvent: ScheduleEvent | null;
  prevEvent: ScheduleEvent | null;
  /** Event that just expired (end_time passed within last 5 minutes) — used for "Still going?" nudge */
  expiredEvent: ScheduleEvent | null;
  todayEvents: ScheduleEvent[];
  // How many minutes left in current event (null if no current event)
  timeRemaining: number | null;
  // 0-100 progress through current event
  progress: number;
  // When is free time until (if no active event) — the start of the next event
  freeUntil: Date | null;
  // Is next event within 30 minutes?
  approaching: boolean;
  // Minutes until next event starts (null if no next event)
  minutesToNext: number | null;
  loading: boolean;
  refresh: () => void;
}

// How long after an event ends to show the "Still going?" nudge (ms)
const EXPIRY_NUDGE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function computeState(events: ScheduleEvent[], now: Date): Omit<CurrentEventState, 'loading' | 'todayEvents' | 'refresh'> {
  const nowMs = now.getTime();

  // Sort by start time
  const sorted = [...events].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  // Find current active event (now is between start and end, or live event with no end_time)
  const currentEvent = sorted.find(ev => {
    const start = new Date(ev.start_time).getTime();
    // Live events have end_time: null — they're always "current" once started
    if (!ev.end_time) return nowMs >= start;
    const end = new Date(ev.end_time).getTime();
    return nowMs >= start && nowMs < end;
  }) ?? null;

  // Next upcoming event (starts after now, or after current event ends)
  const nextEvent = sorted.find(ev => {
    const start = new Date(ev.start_time).getTime();
    return start > nowMs;
  }) ?? null;

  // Previous event (ended before now)
  const pastEvents = sorted.filter(ev => ev.end_time && new Date(ev.end_time).getTime() <= nowMs);
  const prevEvent = pastEvents.length > 0 ? pastEvents[pastEvents.length - 1] : null;

  // Expired event: just ended within the nudge window (5 min), no current event active
  // This powers the "Still going?" prompt
  let expiredEvent: ScheduleEvent | null = null;
  if (!currentEvent && prevEvent?.end_time) {
    const endedMs = new Date(prevEvent.end_time).getTime();
    const sinceExpiry = nowMs - endedMs;
    if (sinceExpiry >= 0 && sinceExpiry <= EXPIRY_NUDGE_WINDOW_MS && !prevEvent.completed) {
      expiredEvent = prevEvent;
    }
  }

  // Compute time remaining & progress for current event
  let timeRemaining: number | null = null;
  let progress = 0;
  if (currentEvent) {
    const startMs = new Date(currentEvent.start_time).getTime();
    if (!currentEvent.end_time) {
      // Live event with no end_time — show elapsed, no progress bar
      const elapsedMin = Math.floor((nowMs - startMs) / 60000);
      timeRemaining = elapsedMin; // repurposed: shows elapsed for live events
      progress = 0; // indeterminate — live events have no fixed end
    } else {
      const endMs = new Date(currentEvent.end_time).getTime();
      const totalMs = endMs - startMs;
      const elapsedMs = nowMs - startMs;
      timeRemaining = Math.max(0, Math.floor((endMs - nowMs) / 60000)); // in minutes
      progress = totalMs > 0 ? Math.min(100, (elapsedMs / totalMs) * 100) : 0;
    }
  }

  // Free until
  const freeUntil = nextEvent ? new Date(nextEvent.start_time) : null;

  // Approaching: next event within 30 minutes
  let minutesToNext: number | null = null;
  let approaching = false;
  if (nextEvent) {
    const nextStartMs = new Date(nextEvent.start_time).getTime();
    minutesToNext = Math.floor((nextStartMs - nowMs) / 60000);
    approaching = minutesToNext >= 0 && minutesToNext <= 30;
  }

  return { currentEvent, nextEvent, prevEvent, expiredEvent, timeRemaining, progress, freeUntil, approaching, minutesToNext };
}

export function useCurrentEvent(): CurrentEventState {
  const userId = useUserStore(s => s.user?.id);
  const [todayEvents, setTodayEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [_tick, setTick] = useState(0);

  const fetchEvents = useCallback(async () => {
    const now = new Date();
    // Build local midnight boundaries as ISO strings WITHOUT timezone shift.
    // toISOString() converts to UTC which shifts the day boundary — instead,
    // format the local date explicitly so the query filters on the user's
    // actual calendar day regardless of timezone offset.
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const dayStartISO = `${y}-${m}-${d}T00:00:00`;
    const dayEndISO = `${y}-${m}-${d}T23:59:59`;

    // Fetch scheduled events for today + live events + cross-midnight events
    const [{ data: todayData }, { data: liveData }, { data: crossMidnightData }] = await Promise.all([
      supabase
        .from('schedule_events')
        .select('*')
        .eq('is_deleted', false)
        .gte('start_time', dayStartISO)
        .lte('start_time', dayEndISO)
        .order('start_time'),
      supabase
        .from('schedule_events')
        .select('*')
        .eq('is_deleted', false)
        .eq('is_live', true)
        .order('start_time'),
      // Events that started BEFORE today but end DURING/AFTER today
      supabase
        .from('schedule_events')
        .select('*')
        .eq('is_deleted', false)
        .lt('start_time', dayStartISO)
        .gt('end_time', dayStartISO)
        .order('start_time'),
    ]);

    // Merge, deduplicate by id
    const merged = new Map<string, any>();
    for (const ev of (todayData || [])) merged.set(ev.id, ev);
    for (const ev of (liveData || [])) merged.set(ev.id, ev);
    for (const ev of (crossMidnightData || [])) merged.set(ev.id, ev);

    setTodayEvents(Array.from(merged.values()));
    setLoading(false);
  }, []);

  // Initial load + listen for refresh events + Supabase Realtime
  useEffect(() => {
    fetchEvents();
    const handler = () => fetchEvents();
    window.addEventListener('lifeos-refresh', handler);
    const vis = () => { if (document.visibilityState === 'visible') fetchEvents(); };
    document.addEventListener('visibilitychange', vis);

    // Realtime: auto-refresh when schedule_events change (INSERT/UPDATE/DELETE)
    if (!userId) return () => {
      window.removeEventListener('lifeos-refresh', handler);
      document.removeEventListener('visibilitychange', vis);
    };

    const channel = supabase
      .channel('schedule-events-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedule_events', filter: `user_id=eq.${userId}` },
        () => { fetchEvents(); }
      )
      .subscribe();

    return () => {
      window.removeEventListener('lifeos-refresh', handler);
      document.removeEventListener('visibilitychange', vis);
      supabase.removeChannel(channel);
    };
  }, [fetchEvents, userId]);

  // Tick every 10 seconds for responsive progress/time-remaining updates
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  const now = new Date();
  const computed = computeState(todayEvents, now);

  return {
    ...computed,
    todayEvents,
    loading,
    refresh: fetchEvents,
  };
}
