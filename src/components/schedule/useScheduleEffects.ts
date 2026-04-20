/**
 * useScheduleEffects — Extracted useEffect hooks and event fetchers for Schedule.
 *
 * Encapsulates:
 * - Deep-link from notifications
 * - Body class management
 * - Store hydration
 * - Event fetchers (day/week/month)
 * - Refresh + visibility listeners
 * - Cmd+Z undo keydown
 * - Auto-scroll to current time
 * - Live event auto-scroll
 */
import { useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useFinanceStore } from '../../stores/useFinanceStore';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useLiveActivityStore } from '../../stores/useLiveActivityStore';
import { localDateStr } from '../../utils/date';

interface UseScheduleEffectsArgs {
  selectedDate: Date;
  setSelectedDate: (d: Date) => void;
  setEvents: React.Dispatch<React.SetStateAction<import('./types').ScheduleEvent[]>>;
  setAllEvents: React.Dispatch<React.SetStateAction<import('./types').ScheduleEvent[]>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  view: string;
  calMonth: number;
  calYear: number;
  weekStart: Date;
  undoStack: Array<{ id: string; title: string }>;
  undoLastDelete: () => void;
  liveBlock: { startMin: number; endMin: number; elapsedMin: number } | null;
  hourH: number;
  showAllHours: boolean;
  effectiveStart: number;
  isTodaySel: boolean;
  loading: boolean;
}

export function useScheduleEffects({
  selectedDate,
  setSelectedDate,
  setEvents,
  setAllEvents,
  setLoading,
  view,
  calMonth,
  calYear,
  weekStart,
  undoStack,
  undoLastDelete,
  liveBlock,
  hourH,
  showAllHours,
  effectiveStart,
  isTodaySel,
  loading,
}: UseScheduleEffectsArgs) {
  const [searchParams, setSearchParams] = useSearchParams();
  const undoStackRef = useRef(undoStack);
  undoStackRef.current = undoStack;
  const initialScrollDone = useRef(false);

  // ── Fetchers ──

  const fetchDayEvents = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    await useScheduleStore.getState().fetchAll();
    useHabitsStore.getState().fetchAll();
    useFinanceStore.getState().fetchAll();
    useGoalsStore.getState().fetchAll();
    const dayStr = localDateStr(selectedDate);
    const evData = useScheduleStore.getState().fetchEventsForDay(dayStr);
    setEvents(evData);
    setLoading(false);
  }, [selectedDate]);

  const fetchWeekEvents = useCallback(async () => {
    await useScheduleStore.getState().fetchAll();
    const data = useScheduleStore.getState().fetchEventsForWeek(weekStart);
    setAllEvents(data);
  }, [weekStart]);

  const fetchMonthEvents = useCallback(async () => {
    await useScheduleStore.getState().fetchAll();
    const data = useScheduleStore.getState().fetchEventsForMonth(calYear, calMonth);
    setAllEvents(data);
  }, [calMonth, calYear]);

  // ── Effects ──

  // Body class for page-schedule
  useEffect(() => {
    document.body.classList.add('page-schedule');
    return () => { document.body.classList.remove('page-schedule'); };
  }, []);

  // Hydrate live activity store on mount
  useEffect(() => {
    useLiveActivityStore.getState().hydrate();
  }, []);

  // Deep-link from notifications
  useEffect(() => {
    const dateParam = searchParams.get('date');
    const highlightParam = searchParams.get('highlight');
    if (dateParam) {
      setSelectedDate(new Date(dateParam + 'T12:00:00'));
    }
    if (highlightParam) {
      setTimeout(() => {
        const el = document.querySelector(`[data-event-id="${highlightParam}"], [data-task-id="${highlightParam}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('stl-highlight-pulse');
          setTimeout(() => el.classList.remove('stl-highlight-pulse'), 2500);
        }
      }, 600);
    }
    if (dateParam || highlightParam) {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Initial data fetch based on view
  const initialLoad = useRef(true);
  useEffect(() => {
    const isFirst = initialLoad.current;
    initialLoad.current = false;
    if (view === 'day' || view === 'timeline') fetchDayEvents(isFirst);
    else if (view === 'week') fetchWeekEvents();
    else if (view === 'board') { /* Board reads from store — already fetched */ }
    else fetchMonthEvents();
  }, [view, fetchDayEvents, fetchWeekEvents, fetchMonthEvents]);

  // Refresh + visibility listeners
  useEffect(() => {
    const h = () => {
      if (view === 'day' || view === 'timeline') fetchDayEvents();
      else if (view === 'week') fetchWeekEvents();
      else if (view === 'board') { /* Board uses store data */ }
      else fetchMonthEvents();
    };
    window.addEventListener('lifeos-refresh', h);
    const vis = () => { if (document.visibilityState === 'visible') h(); };
    document.addEventListener('visibilitychange', vis);
    return () => {
      window.removeEventListener('lifeos-refresh', h);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [view, fetchDayEvents, fetchWeekEvents, fetchMonthEvents]);

  // Cmd+Z / Ctrl+Z undo keydown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && undoStackRef.current.length > 0) {
        e.preventDefault();
        undoLastDelete();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoLastDelete]);

  // Auto-scroll to keep live event's growing edge visible (every 30s)
  useEffect(() => {
    if (!liveBlock || view !== 'day') return;

    const scrollToLive = () => {
      const fh = showAllHours ? 0 : effectiveStart;
      const growingEdgePx = ((liveBlock.endMin / 60) - fh) * hourH;
      const containerHeight = window.innerHeight;
      const scrollTarget = growingEdgePx - containerHeight * 0.6;
      const currentScroll = window.scrollY;
      const edgeInView = growingEdgePx > currentScroll && growingEdgePx < currentScroll + containerHeight;
      if (!edgeInView) {
        window.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
      }
    };

    const timeout = setTimeout(scrollToLive, 500);
    const interval = setInterval(scrollToLive, 30000);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [liveBlock, hourH, showAllHours, effectiveStart, view]);

  // Auto-scroll current time to upper third of viewport on load and every 60s
  useEffect(() => {
    if (view !== 'day' || loading) return;
    if (!isTodaySel) { initialScrollDone.current = false; return; }

    const scrollToNow = (smooth: boolean) => {
      const now = new Date();
      const currentMin = now.getHours() * 60 + now.getMinutes();
      const fh = showAllHours ? 0 : effectiveStart;
      const nowPx = ((currentMin / 60) - fh) * hourH;
      const offset = nowPx - (window.innerHeight * 0.15);
      if (offset > 0) {
        window.scrollTo({ top: offset, behavior: smooth ? 'smooth' : 'auto' });
      }
    };

    if (!initialScrollDone.current) {
      const timeout = setTimeout(() => {
        scrollToNow(false);
        initialScrollDone.current = true;
      }, 300);
      return () => clearTimeout(timeout);
    }

    const interval = setInterval(() => scrollToNow(true), 60000);
    return () => clearInterval(interval);
  }, [view, loading, isTodaySel, showAllHours, effectiveStart, hourH]);

  return {
    fetchDayEvents,
    fetchWeekEvents,
    fetchMonthEvents,
  };
}