import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/useUserStore';
import { useScheduleStore } from '../stores/useScheduleStore';
import { useHabitsStore } from '../stores/useHabitsStore';
import type { HabitLog } from '../stores/useHabitsStore';
import { useFinanceStore } from '../stores/useFinanceStore';
import { useGoalsStore } from '../stores/useGoalsStore';
import { useLiveActivityStore } from '../stores/useLiveActivityStore';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EventDetail } from '../components/EventDetail';
import { useEventOverlay } from '../components/EventOverlay';
import { showToast } from '../components/Toast';
import { LiveTimelineEvent } from '../components/LiveTimelineEvent';
import { Plus, Clock, ChevronLeft, ChevronRight, Loader2, List, Grid3x3, Calendar as CalendarIcon, CheckCircle2, Circle, Flame, Receipt, Target, ChevronDown, ChevronUp, ZoomIn, ZoomOut, Sun, AlertTriangle, DollarSign, Play, Trash2, X, Layers, ClipboardList, Settings, Cross } from 'lucide-react';
import { EmojiIcon } from '../lib/emoji-icon';
import { TimePicker } from '../components/TimePicker';
import { TaskDetail } from '../components/TaskDetail';
import { UnifiedTimeline } from '../components/schedule/UnifiedTimeline';
import { ScheduleHeader } from '../components/schedule/ScheduleHeader';
import { ScheduleMonthView } from '../components/schedule/ScheduleMonthView';
import { ScheduleWeekView } from '../components/schedule/ScheduleWeekView';
import { ErrorCard } from '../components/ui/ErrorCard';
import { localDateStr, genId } from '../utils/date';
import { createScheduleEvent, EVENT_TYPES, PRIMARY_TYPES, OPERATIONS_TYPES, SACRED_TYPES, getLayerForType, getColorForType, type ScheduleLayer, type EventType, type EventTypeInfo } from '../lib/schedule-events';
import { useSacredSchedule } from '../hooks/useSacredSchedule';
import { useGoogleCalendar, type GoogleScheduleEvent } from '../hooks/useGoogleCalendar';
import { SpotlightTour } from '../components/SpotlightTour';
import { ScheduleOptimizer } from '../components/schedule/ScheduleOptimizer';
import { BottomSheet } from '../components/BottomSheet';
import type { ScheduleEvent as ScheduleEventType, ScheduleTask, ScheduleHabit, ScheduleBill, ScheduleGoal, LayerFilter, ViewType } from '../components/schedule/types';
import { fmtDisplay, fmtHourLabel, timeStr, snap15, calculateFreeTime, getNextEvent, getMonthGrid, WAKE_START, WAKE_END, MONTHS, DAYS_SHORT, MIN_HOUR_H, MAX_HOUR_H, DEFAULT_HOUR_H, ZOOM_STEP, DURATIONS, PRIORITIES } from '../components/schedule/utils';
import './Schedule.css';
import { logger } from '../utils/logger';
import { useGamificationContext } from '../lib/gamification/context';
import { ScheduleSkeleton } from '../components/skeletons';

// ── Types & Constants ──
// (Now imported from ./components/schedule/)
type ScheduleEvent = ScheduleEventType;

const CATEGORIES = EVENT_TYPES.map(t => ({ id: t.id, label: t.label, color: t.color, layer: t.layer, icon: t.icon, emoji: t.emoji }));

function getPreferredHourForTask(task: { title: string; domain?: string }): number {
  const domain = (task as any).domain || inferDomainFromTitle(task.title);
  const defaults: Record<string, number> = {
    education: 6, exercise: 7, prayer: 5, meditation: 6,
    work: 10, financial: 14, health: 15, social: 18,
    personal: 16, creative: 9, general: 9,
  };
  return defaults[domain] || 9;
}

function inferDomainFromTitle(title: string): string {
  const t = title.toLowerCase();
  if (/study|learn|read|course|exam|lesson/.test(t)) return 'education';
  if (/workout|exercise|run|gym|lift|stretch/.test(t)) return 'exercise';
  if (/pray|meditat|quran|bible/.test(t)) return 'prayer';
  if (/budget|invest|tax|save|financ/.test(t)) return 'financial';
  if (/cook|meal|eat|diet|nutrition/.test(t)) return 'health';
  return 'general';
}

export function Schedule() {
  const user = useUserStore(s => s.user);
  const { awardXP } = useGamificationContext();
  const { startOverlay } = useEventOverlay();

  // Add body class to hide EventDrawerHandle on Schedule page (mobile)
  useEffect(() => {
    document.body.classList.add('page-schedule');
    return () => { document.body.classList.remove('page-schedule'); };
  }, []);

  // Deep-link from notifications: ?date=YYYY-MM-DD&highlight=<id>
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [allEvents, setAllEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState<ViewType>('day');
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [error, setError] = useState('');

  // Day context data — from stores (cached)
  const tasks = useScheduleStore(s => s.tasks) as unknown as ScheduleTask[];
  const goals = useGoalsStore(s => s.goals) as unknown as ScheduleGoal[];
  const habits = useHabitsStore(s => s.habits) as unknown as ScheduleHabit[];
  const habitLogs = useHabitsStore(s => s.logs) as HabitLog[];
  const bills = useFinanceStore(s => s.bills) as unknown as ScheduleBill[];

  // Live Activity Store — subscribe to coarse elapsed (30s granularity) to avoid per-second re-renders of 1600-line component
  const liveActiveEvent = useLiveActivityStore(s => s.activeEvent);
  const liveElapsedSeconds = useLiveActivityStore(s => Math.floor(s.elapsedSeconds / 30) * 30);
  const liveMetadata = useLiveActivityStore(s => s.metadata);

  // Google Calendar integration
  const { googleEvents } = useGoogleCalendar();

  // Sacred schedule overlay (spiritual blocks)
  const { sacredBlocks, overlayOpacity, isEquipped: junctionEquipped, spiritualLevel, tradition: junctionTradition, sacredLayout, glowIntensity } = useSacredSchedule();

  // Calculate Junction level from spiritual level (tier 0-7+)
  const junctionLevel = useMemo(() => {
    const xp = spiritualLevel * 12000; // Reverse spiritualLevel calculation
    if (xp >= 12000) return 7;
    if (xp >= 8000) return 6;
    if (xp >= 5000) return 5;
    if (xp >= 3000) return 4;
    if (xp >= 1500) return 3;
    if (xp >= 500) return 2;
    if (xp > 0) return 1;
    return 0;
  }, [spiritualLevel]);

  // Hydrate live activity store on mount
  useEffect(() => {
    useLiveActivityStore.getState().hydrate();
  }, []);

  // Auto-scroll ref for live event growing edge
  const liveEventRef = useRef<HTMLDivElement>(null);

  // Layer filter
  const [layerFilter, setLayerFilter] = useState<LayerFilter>(() => {
    try { return (localStorage.getItem('lifeos-schedule-layer') as LayerFilter) || 'all'; } catch { return 'all'; }
  });
  const setLayerFilterPersist = (lf: LayerFilter) => {
    setLayerFilter(lf);
    try { localStorage.setItem('lifeos-schedule-layer', lf); } catch {}
  };

  // Desktop multi-column detection (≥1200px)
  const [isDesktopWide, setIsDesktopWide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1200);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1200px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktopWide(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  const isMultiCol = isDesktopWide && layerFilter === 'all';

  const [title, setTitle] = useState('');
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(60);
  const [category, setCategory] = useState('general');
  const [eventType, setEventType] = useState<EventType>('general');
  const [formLayer, setFormLayer] = useState<ScheduleLayer>('primary');
  const [desc, setDesc] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingAtHour, setAddingAtHour] = useState<number | null>(null);
  
  // Event form: goal linking
  const [eventObjective, setEventObjective] = useState('');
  const [eventEpic, setEventEpic] = useState('');
  const [eventGoal, setEventGoal] = useState('');
  const [eventPriority, setEventPriority] = useState('medium');
  
  // TaskDetail modal
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  
  // Event detail modal
  const [detailEvent, setDetailEvent] = useState<Partial<ScheduleEvent> & { id: string; title: string; start_time: string } | null>(null);

  // Confirm dialog
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMsg, setConfirmMsg] = useState({ title: '', message: '' });

  // Compact context toggle
  const [contextCollapsed, setContextCollapsed] = useState(true);

  // Zoom (hour height)
  const [hourH, setHourH] = useState(DEFAULT_HOUR_H);

  // Show all 24h vs waking hours
  const [showAllHours, setShowAllHours] = useState(true);

  // Time format: 12h vs 24h
  const [use24h, setUse24h] = useState(() => {
    try { return localStorage.getItem('lifeos-schedule-24h') === 'true'; } catch { return false; }
  });
  const toggleTimeFormat = () => {
    setUse24h(prev => {
      const next = !prev;
      try { localStorage.setItem('lifeos-schedule-24h', String(next)); } catch {}
      return next;
    });
  };

  // Drag state (desktop HTML5 drag)
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragGhostTop, setDragGhostTop] = useState<number | null>(null);
  const [dropHour, setDropHour] = useState<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Touch drag state (mobile long-press + vertical drag to reschedule)
  const [touchDragId, setTouchDragId] = useState<string | null>(null);
  const [touchDragTopPx, setTouchDragTopPx] = useState<number | null>(null);
  const touchDragStartY = useRef(0);
  const touchDragOrigTop = useRef(0);
  const touchDragActive = useRef(false); // true once long-press fires and drag begins
  const touchDragTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchDragJustEnded = useRef(false); // suppress click after drag

  // Resize state
  const [resizeId, setResizeId] = useState<string | null>(null);
  const [resizeH, setResizeH] = useState<number | null>(null);
  const resizeStartY = useRef(0);
  const resizeStartH = useRef(0);

  // Swipe-to-delete state
  const [swipeId, setSwipeId] = useState<string | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const swipeStartX = useRef(0);
  const swipeStartY = useRef(0);
  const swipeThreshold = -80; // pixels to trigger delete

  // Week view state
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday as start
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    return monday;
  });

  const confirmDelete = (title: string, message: string, action: () => void) => {
    setConfirmMsg({ title, message });
    setConfirmAction(() => action);
  };

  const fetchDayEvents = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    
    // Ensure stores are hydrated (no-op if already cached)
    await useScheduleStore.getState().fetchAll();
    useHabitsStore.getState().fetchAll();
    useFinanceStore.getState().fetchAll();
    useGoalsStore.getState().fetchAll();

    // Fetch events from store (local-first, works offline)
    const dayStr = localDateStr(selectedDate);
    const evData = useScheduleStore.getState().fetchEventsForDay(dayStr);
    setEvents(evData);

    setLoading(false);
  }, [selectedDate]);

  // Handle deep-link params from notification clicks
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

  const fetchWeekEvents = useCallback(async () => {
    // Ensure store is hydrated
    await useScheduleStore.getState().fetchAll();
    
    // Fetch events from store (local-first, works offline)
    const data = useScheduleStore.getState().fetchEventsForWeek(weekStart);
    setAllEvents(data);
  }, [weekStart]);

  const fetchMonthEvents = useCallback(async () => {
    // Ensure store is hydrated
    await useScheduleStore.getState().fetchAll();
    
    // Fetch events from store (local-first, works offline)
    const data = useScheduleStore.getState().fetchEventsForMonth(calYear, calMonth);
    setAllEvents(data);
  }, [calMonth, calYear]);

  const initialLoad = useRef(true);
  useEffect(() => { 
    const isFirst = initialLoad.current;
    initialLoad.current = false;
    if (view === 'day' || view === 'timeline') fetchDayEvents(isFirst);
    else if (view === 'week') fetchWeekEvents();
    else fetchMonthEvents();
  }, [view, fetchDayEvents, fetchWeekEvents, fetchMonthEvents]);

  useEffect(() => {
    const h = () => { 
      if (view === 'day' || view === 'timeline') fetchDayEvents();
      else if (view === 'week') fetchWeekEvents();
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

  const shiftDay = (n: number) => { 
    const d = new Date(selectedDate); 
    d.setDate(d.getDate() + n); 
    setSelectedDate(d); 
  };

  const shiftWeek = (n: number) => {
    const w = new Date(weekStart);
    w.setDate(w.getDate() + (n * 7));
    setWeekStart(w);
  };

  const goToday = () => { 
    const today = new Date();
    setSelectedDate(today);
    setCalMonth(today.getMonth());
    setCalYear(today.getFullYear());
    
    // Reset week view to current week
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    setWeekStart(monday);
  };

  const todayStr = localDateStr(new Date());
  const selStr = localDateStr(selectedDate);
  const isToday = selStr === todayStr;

  const shiftMonth = (n: number) => {
    let m = calMonth + n;
    let y = calYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setCalMonth(m);
    setCalYear(y);
  };

  const selectCalDay = (iso: string) => {
    const d = new Date(iso + 'T12:00:00');
    setSelectedDate(d);
    setView('day');
  };

  const eventsByDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const ev of allEvents) {
      const start = new Date(ev.start_time);
      const end = ev.end_time ? new Date(ev.end_time) : start;
      const d = new Date(start);
      d.setHours(0, 0, 0, 0);
      const endDay = new Date(end);
      endDay.setHours(0, 0, 0, 0);
      while (d <= endDay) {
        const key = localDateStr(d);
        map[key] = (map[key] || 0) + 1;
        d.setDate(d.getDate() + 1);
      }
    }
    return map;
  }, [allEvents]);

  const monthGrid = useMemo(() => getMonthGrid(calYear, calMonth), [calYear, calMonth]);

  const createEvent = async () => {
    if (!title.trim()) return;
    setSaving(true);
    setError('');
    
    let start: Date, end: Date;
    
    if (allDay) {
      start = new Date(`${localDateStr(selectedDate)}T00:00:00`);
      end = new Date(`${localDateStr(selectedDate)}T23:59:59`);
    } else {
      start = new Date(`${localDateStr(selectedDate)}T${time}:00`);
      end = new Date(start.getTime() + duration * 60000);
    }
    
    try {
      await createScheduleEvent(supabase, {
        userId:      user?.id || '',
        title:       title.trim(),
        startTime:   start.toISOString(),
        endTime:     end.toISOString(),
        description: desc.trim() || null,
        category,
        eventType,
        scheduleLayer: formLayer,
        source: 'webapp',
        allDay,
        goalTag:     eventGoal || null,
        priority:    eventPriority,
      });
      
      awardXP('schedule_event', { description: title.trim() });
      setTitle(''); setTime('09:00'); setDuration(60); setCategory('general'); setEventType('general'); setFormLayer('primary'); setDesc(''); setAllDay(false);
      setEventObjective(''); setEventEpic(''); setEventGoal(''); setEventPriority('medium');
      setShowForm(false); setAddingAtHour(null);
      if (view === 'day') fetchDayEvents();
      else if (view === 'week') fetchWeekEvents();
      else fetchMonthEvents();
    } catch (e: any) {
      setError(e.message || 'Failed to create event');
    }
    setSaving(false);
  };

  // Undo stack for event deletion (Cmd+Z / Ctrl+Z support)
  const [undoStack, setUndoStack] = useState<Array<{ id: string; title: string }>>([]);
  const undoStackRef = useRef(undoStack);
  undoStackRef.current = undoStack;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && undoStackRef.current.length > 0) {
        e.preventDefault();
        undoLastDelete();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteEvent = async (id: string) => {
    // Optimistic: remove from UI immediately
    const deletedEvent = events.find(e => e.id === id);
    const prevEvents = [...events];
    useScheduleStore.setState({ events: events.filter(e => e.id !== id) });

    setConfirmAction(null);
    setDetailEvent(null);

    // Show undo toast
    if (deletedEvent) {
      setUndoStack(prev => [...prev, { id, title: (deletedEvent as any).title || 'Event' }]);
      showToast(`Deleted "${(deletedEvent as any).title}"`, '🗑️', '#F43F5E');
    }

    // Background: persist soft delete
    try {
      await supabase.from('schedule_events')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', id);
    } catch {
      // Rollback on failure
      useScheduleStore.setState({ events: prevEvents });
      showToast('Failed to delete event', '⚠️', '#F43F5E');
    }
  };

  const undoLastDelete = async () => {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;
    setUndoStack(prev => prev.slice(0, -1));

    await supabase.from('schedule_events')
      .update({ is_deleted: false, updated_at: new Date().toISOString() })
      .eq('id', last.id);

    // Refetch to restore
    if (view === 'day') fetchDayEvents();
    else if (view === 'week') fetchWeekEvents();
    else fetchMonthEvents();
    showToast(`Restored "${last.title}"`, '↩️', '#39FF14');
  };

  const massDeleteDayEvents = async () => {
    const dayEvs = filteredEvents.filter(e => !(e as any).is_google);
    if (dayEvs.length === 0) return;

    // Optimistic: clear all from UI
    const prevEvents = [...events];
    const dayIds = new Set(dayEvs.map(e => e.id));
    useScheduleStore.setState({ events: events.filter(e => !dayIds.has(e.id)) });

    showToast(`Deleted ${dayEvs.length} events`, '🗑️', '#F43F5E');

    // Background: persist
    try {
      await supabase.from('schedule_events')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .in('id', dayEvs.map(e => e.id));
    } catch {
      useScheduleStore.setState({ events: prevEvents });
      showToast('Failed to delete events', '⚠️', '#F43F5E');
    }
  };

  const nowDate = new Date();
  const isTodaySel = selStr === localDateStr(nowDate);

  // Compute effective start hour dynamically based on live event + scheduled events
  const effectiveStart = useMemo(() => {
    if (showAllHours) return 0;
    let start = WAKE_START;

    // Include live event start hour
    if (liveActiveEvent) {
      const liveHour = new Date(liveActiveEvent.start_time).getHours();
      start = Math.min(start, liveHour);
    }

    // Include any scheduled events before WAKE_START
    events.forEach(ev => {
      const h = new Date(ev.start_time).getHours();
      if (h < start) start = h;
    });

    // Also check if current time (today) is before WAKE_START — always show "now"
    if (isTodaySel) {
      const nowHour = new Date().getHours();
      if (nowHour < start) start = nowHour;
    }

    return start;
  }, [showAllHours, liveActiveEvent, events, isTodaySel]);

  // Derive which hours to show
  const hours = useMemo(() => {
    if (showAllHours) return Array.from({ length: 24 }, (_, i) => i);
    return Array.from({ length: WAKE_END - effectiveStart }, (_, i) => i + effectiveStart);
  }, [showAllHours, effectiveStart]);

  const dayTasks = useMemo(() => tasks.filter(t => {
    if (t.due_date === selStr) return true;
    if (t.completed_at && t.completed_at.startsWith(selStr)) return true;
    if (!t.due_date && isTodaySel && t.status !== 'done') return true;
    return false;
  }), [tasks, selStr, isTodaySel]);

  const dayHabitLogs = useMemo(() => habitLogs.filter(l => l.date === selStr), [habitLogs, selStr]);
  const dayBills = useMemo(() => bills.filter(b => b.due_date === selStr && b.status !== 'paid'), [bills, selStr]);

  const dayActiveTasks = dayTasks.filter(t => t.status !== 'done');
  const dayDoneTasks = dayTasks.filter(t => t.status === 'done');
  const dayHabitsDone = useMemo(() => habits.filter(h => {
    const hLogs = dayHabitLogs.filter(l => l.habit_id === h.id);
    return hLogs.reduce((s: number, l: HabitLog) => s + (l.count || 1), 0) >= (h.target_count || 1);
  }).length, [habits, dayHabitLogs]);

  const getChain = useCallback((goalId: string | null): string => {
    if (!goalId) return '';
    const chain: string[] = [];
    let cur: string | null = goalId;
    while (cur) {
      const g = goals.find((x: ScheduleGoal) => x.id === cur);
      if (!g) break;
      chain.unshift(g.title);
      cur = g.parent_goal_id;
    }
    return chain.join(' › ');
  }, [goals]);

  const toggleTask = async (id: string, status: string) => {
    await useScheduleStore.getState().changeTaskStatus(id, status === 'done' ? 'pending' : 'done');
    fetchDayEvents();
  };

  const toggleHabit = async (habitId: string) => {
    await useHabitsStore.getState().toggleHabit(habitId, selStr);
  };

  const openAddAtHour = (hour: number) => {
    const hStr = hour.toString().padStart(2, '0');
    setTime(`${hStr}:00`);
    setAddingAtHour(hour);
    setShowForm(true);
  };

  // Cascading goal hierarchy for event linking
  const objectives = useMemo(() => goals.filter((g: ScheduleGoal) => !g.parent_goal_id && g.type === 'objective'), [goals]);
  const epics = useMemo(() => goals.filter((g: ScheduleGoal) => g.parent_goal_id === eventObjective && g.type === 'epic'), [goals, eventObjective]);
  const linkableGoals = useMemo(() => goals.filter((g: ScheduleGoal) => g.parent_goal_id === eventEpic && g.type === 'goal'), [goals, eventEpic]);

  // Zoom handlers
  const zoomIn = () => setHourH(h => Math.min(h + ZOOM_STEP, MAX_HOUR_H));
  const zoomOut = () => setHourH(h => Math.max(h - ZOOM_STEP, MIN_HOUR_H));

  // Drag-to-move handlers
  const handleDragStart = (e: React.DragEvent, eventId: string) => {
    setDragId(eventId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', eventId);
    const el = e.currentTarget as HTMLElement;
    if (el) {
      const ghost = el.cloneNode(true) as HTMLElement;
      ghost.style.opacity = '0.7';
      ghost.style.position = 'absolute';
      ghost.style.top = '-9999px';
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 20, 10);
      setTimeout(() => document.body.removeChild(ghost), 0);
    }
  };

  const handleDragEnd = () => {
    setDragId(null);
    setDragGhostTop(null);
    setDropHour(null);
  };

  const getMinutesFromY = useCallback((clientY: number): number => {
    if (!timelineRef.current) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    const y = clientY - rect.top + timelineRef.current.scrollTop;
    const fh = showAllHours ? 0 : effectiveStart;
    const rawMin = (y / hourH) * 60 + fh * 60;
    return snap15(Math.max(0, Math.min(rawMin, 1439)));
  }, [hourH, showAllHours, effectiveStart]);

  const handleTimelineDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    setDragGhostTop(y);
    const minutes = getMinutesFromY(e.clientY);
    setDropHour(Math.floor(minutes / 60));
  };

  const handleTimelineDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const eventId = e.dataTransfer.getData('text/plain');
    if (!eventId) return;
    
    const ev = events.find(ev => ev.id === eventId);
    if (!ev) return;

    const newStartMin = getMinutesFromY(e.clientY);
    const oldStart = new Date(ev.start_time);
    const oldEnd = new Date(ev.end_time);
    const durationMs = oldEnd.getTime() - oldStart.getTime();

    const newStart = new Date(selectedDate);
    newStart.setHours(0, 0, 0, 0);
    newStart.setMinutes(newStartMin);
    const newEnd = new Date(newStart.getTime() + durationMs);

    const newStartISO = newStart.toISOString();
    const newEndISO = newEnd.toISOString();

    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, start_time: newStartISO, end_time: newEndISO } : e));
    setDragId(null);
    setDragGhostTop(null);
    setDropHour(null);

    const { error } = await supabase.from('schedule_events').update({
      start_time: newStartISO,
      end_time: newEndISO,
      updated_at: new Date().toISOString(),
    }).eq('id', eventId);

    if (error) {
      logger.error('[Schedule] drop save error:', error);
      fetchDayEvents();
    }
    if (view === 'week') fetchWeekEvents();
    if (view === 'month') fetchMonthEvents();
  };

  // Resize handlers (pointer events)
  const handleResizeStart = (e: React.PointerEvent, eventId: string, currentHeight: number) => {
    e.preventDefault();
    e.stopPropagation();
    setResizeId(eventId);
    resizeStartY.current = e.clientY;
    resizeStartH.current = currentHeight;
    setResizeH(currentHeight);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleResizeMove = useCallback((e: React.PointerEvent) => {
    if (!resizeId) return;
    const dy = e.clientY - resizeStartY.current;
    const newH = Math.max(hourH / 4, resizeStartH.current + dy);
    setResizeH(newH);
  }, [resizeId, hourH]);

  const handleResizeEnd = useCallback(async (e: React.PointerEvent) => {
    if (!resizeId || resizeH === null) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    const ev = events.find(ev => ev.id === resizeId);
    if (!ev) { setResizeId(null); setResizeH(null); return; }

    const newDurationMin = snap15(Math.max(15, (resizeH / hourH) * 60));
    const start = new Date(ev.start_time);
    const newEnd = new Date(start.getTime() + newDurationMin * 60000);
    const newEndISO = newEnd.toISOString();
    const eventId = resizeId;

    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, end_time: newEndISO } : e));
    setResizeId(null);
    setResizeH(null);

    const { error } = await supabase.from('schedule_events').update({
      end_time: newEndISO,
      updated_at: new Date().toISOString(),
    }).eq('id', eventId);

    if (error) {
      logger.error('[Schedule] resize save error:', error);
      fetchDayEvents();
    }
    if (view === 'week') fetchWeekEvents();
    if (view === 'month') fetchMonthEvents();
  }, [resizeId, resizeH, events, hourH, view, fetchDayEvents, fetchWeekEvents, fetchMonthEvents]);

  // Swipe-to-delete handlers
  const handleSwipeStart = (e: React.TouchEvent, eventId: string) => {
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
    setSwipeId(eventId);
    setSwipeX(0);
    touchDragActive.current = false;

    // Start long-press timer (1 second to activate drag mode)
    if (touchDragTimer.current) clearTimeout(touchDragTimer.current);
    touchDragTimer.current = setTimeout(() => {
      // Activate touch drag mode
      touchDragActive.current = true;
      setTouchDragId(eventId);
      const evEl = (e.target as HTMLElement).closest('.stl-event') as HTMLElement;
      if (evEl) {
        touchDragOrigTop.current = parseFloat(evEl.style.top) || 0;
        touchDragStartY.current = swipeStartY.current;
        setTouchDragTopPx(touchDragOrigTop.current);
      }
      if (navigator.vibrate) navigator.vibrate(50);
    }, 800);
  };

  const handleSwipeMove = (e: React.TouchEvent) => {
    if (!swipeId) return;
    const deltaX = e.touches[0].clientX - swipeStartX.current;
    const deltaY = e.touches[0].clientY - swipeStartY.current;

    // If touch drag is active (long-press fired), handle vertical repositioning
    if (touchDragActive.current && touchDragId) {
      e.preventDefault();
      const dy = e.touches[0].clientY - touchDragStartY.current;
      const newTop = touchDragOrigTop.current + dy;
      setTouchDragTopPx(Math.max(0, newTop));
      return;
    }

    // Cancel long-press if finger moves more than 10px (user is scrolling/swiping)
    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
      if (touchDragTimer.current) {
        clearTimeout(touchDragTimer.current);
        touchDragTimer.current = null;
      }
    }

    // Only swipe horizontally if more horizontal than vertical
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      e.preventDefault();
      setSwipeX(Math.min(0, deltaX)); // Only allow left swipe
    }
  };

  const handleSwipeEnd = async () => {
    // Clear long-press timer
    if (touchDragTimer.current) {
      clearTimeout(touchDragTimer.current);
      touchDragTimer.current = null;
    }

    // Handle touch drag drop (long-press drag was active)
    if (touchDragActive.current && touchDragId && touchDragTopPx !== null) {
      const ev = events.find(e => e.id === touchDragId);
      if (ev && timelineRef.current) {
        const fh = showAllHours ? 0 : effectiveStart;
        const newStartMin = snap15(Math.max(0, Math.min((touchDragTopPx / hourH) * 60 + fh * 60, 1439)));
        const oldStart = new Date(ev.start_time);
        const oldEnd = new Date(ev.end_time);
        const durationMs = oldEnd.getTime() - oldStart.getTime();

        const newStart = new Date(selectedDate);
        newStart.setHours(0, 0, 0, 0);
        newStart.setMinutes(newStartMin);
        const newEnd = new Date(newStart.getTime() + durationMs);

        const newStartISO = newStart.toISOString();
        const newEndISO = newEnd.toISOString();

        // Optimistic update
        setEvents(prev => prev.map(e => e.id === touchDragId ? { ...e, start_time: newStartISO, end_time: newEndISO } : e));

        const { error } = await supabase.from('schedule_events').update({
          start_time: newStartISO,
          end_time: newEndISO,
          updated_at: new Date().toISOString(),
        }).eq('id', touchDragId);

        if (error) {
          logger.error('[Schedule] touch drag save error:', error);
          fetchDayEvents();
        }
      }

      setTouchDragId(null);
      setTouchDragTopPx(null);
      touchDragActive.current = false;
      touchDragJustEnded.current = true;
      setTimeout(() => { touchDragJustEnded.current = false; }, 300);
      setSwipeId(null);
      setSwipeX(0);
      return;
    }

    // Handle swipe-to-delete
    if (swipeId && swipeX < swipeThreshold) {
      const ev = events.find(e => e.id === swipeId);
      if (ev) {
        confirmDelete(
          'Delete Event',
          `Delete "${ev.title}"?`,
          () => deleteEvent(swipeId)
        );
      }
    }

    // Reset
    touchDragActive.current = false;
    setTouchDragId(null);
    setTouchDragTopPx(null);
    setSwipeId(null);
    setSwipeX(0);
  };

  // Filter events by selected layer, merge Google Calendar events
  const filteredEvents = useMemo(() => {
    let base = layerFilter === 'all' ? events : events.filter(ev => (ev.schedule_layer || 'primary') === layerFilter);

    // Merge Google Calendar events for the selected day
    const selStr = localDateStr(selectedDate);
    const googleForDay = googleEvents
      .filter(ge => ge.date === selStr)
      .map(ge => ({
        ...ge,
        user_id: user?.id || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        schedule_layer: 'primary' as const,
      })) as unknown as ScheduleEvent[];

    return [...base, ...googleForDay];
  }, [events, layerFilter, googleEvents, selectedDate, user?.id]);

  // Task blocks — tasks with due dates appear as timeline blocks
  // Skip tasks that already have schedule_events (smart scheduler created them)
  const taskBlocks = useMemo(() => {
    // Collect task IDs that already have schedule events to avoid duplicates
    const scheduledTaskIds = new Set(
      filteredEvents
        .map(ev => (ev as any).description?.match(/\[task:([^\]]+)\]/)?.[1])
        .filter(Boolean)
    );

    return dayTasks
      .filter(t => t.status !== 'done')
      .filter(t => !scheduledTaskIds.has(t.id))
      .map(t => {
        // Use scheduled_start if available, otherwise domain-preferred hour
        const taskHour = (t as any).scheduled_start
          ? new Date((t as any).scheduled_start).getHours()
          : getPreferredHourForTask(t);
        const duration = (t as any).estimated_duration || 30;
        const startMin = taskHour * 60;
        const endMin = startMin + duration;
        return {
          ...t,
          startMin,
          endMin,
          col: 0,
          totalCols: 1,
          _type: 'task' as const,
        };
      });
  }, [dayTasks, filteredEvents]);

  // Habit blocks — daily habits appear as timeline blocks
  const habitBlocks = useMemo(() => {
    return habits
      .filter(h => h.is_active && h.frequency === 'daily')
      .map((h, idx) => {
        // Stagger habits at 30min intervals starting at 8am
        const startMin = 8 * 60 + (idx * 30);
        const endMin = startMin + 30;
        const hLogs = dayHabitLogs.filter(l => l.habit_id === h.id);
        const isDone = hLogs.reduce((s: number, l: HabitLog) => s + (l.count || 1), 0) >= (h.target_count || 1);
        return {
          ...h,
          startMin,
          endMin,
          col: 0,
          totalCols: 1,
          _type: 'habit' as const,
          _isDone: isDone,
        };
      });
  }, [habits, dayHabitLogs]);

  // Computed event blocks
  const evBlocks = useMemo(() => {
    const blocks = filteredEvents
      .filter(ev => {
        // Skip live events from the regular block rendering — they're rendered by LiveTimelineEvent
        if (ev.is_live || ev.status === 'live') return false;
        // Skip events with no valid end_time (would create garbage blocks)
        if (!ev.end_time) return false;
        return true;
      })
      .map(ev => {
      const s = new Date(ev.start_time);
      const e = new Date(ev.end_time);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;

      // Cross-midnight event support: clamp to selected day boundaries
      const selDateStr = localDateStr(selectedDate);
      const evStartDate = localDateStr(s);
      const evEndDate = localDateStr(e);

      let startMin: number;
      let endMin: number;

      if (evStartDate < selDateStr && evEndDate > selDateStr) {
        // Intermediate day of multi-day event — full day
        startMin = 0;
        endMin = 1440;
      } else if (evStartDate < selDateStr) {
        // Event started before today, ends today
        startMin = 0;
        endMin = e.getHours() * 60 + e.getMinutes();
      } else if (evEndDate > selDateStr) {
        // Event starts today, ends after today
        startMin = s.getHours() * 60 + s.getMinutes();
        endMin = 1440;
      } else {
        // Same-day event
        startMin = s.getHours() * 60 + s.getMinutes();
        endMin = e.getHours() * 60 + e.getMinutes();
        if (endMin <= startMin) endMin += 1440;
      }

      const continuesFromBefore = evStartDate < selDateStr;
      const continuesAfter = evEndDate > selDateStr;

      return { ...ev, startMin, endMin, col: 0, totalCols: 1, _type: 'event' as const, _continuesFromBefore: continuesFromBefore, _continuesAfter: continuesAfter };
    }).filter(Boolean).sort((a: any, b: any) => a.startMin - b.startMin || (b.endMin - b.startMin) - (a.endMin - a.startMin)) as any[];

    for (let i = 0; i < blocks.length; i++) {
      const overlapping = blocks.filter((b, j) => j < i && b.endMin > blocks[i].startMin && b.startMin < blocks[i].endMin);
      const usedCols = new Set(overlapping.map(b => b.col));
      let col = 0;
      while (usedCols.has(col)) col++;
      blocks[i].col = col;
    }
    for (const block of blocks) {
      const group = blocks.filter(b => b.endMin > block.startMin && b.startMin < block.endMin);
      const maxCol = Math.max(...group.map(b => b.col)) + 1;
      for (const b of group) b.totalCols = Math.max(b.totalCols, maxCol);
    }
    return blocks;
  }, [filteredEvents]);

  // Merge all blocks (events, tasks, habits) and recalculate columns
  const allBlocks = useMemo(() => {
    const merged = [...evBlocks, ...taskBlocks, ...habitBlocks]
      .sort((a: any, b: any) => a.startMin - b.startMin || (b.endMin - b.startMin) - (a.endMin - a.startMin));

    // Recalculate column positions for the merged set
    for (let i = 0; i < merged.length; i++) {
      const overlapping = merged.filter((b, j) => j < i && b.endMin > merged[i].startMin && b.startMin < merged[i].endMin);
      const usedCols = new Set(overlapping.map(b => b.col));
      let col = 0;
      while (usedCols.has(col)) col++;
      merged[i].col = col;
    }
    for (const block of merged) {
      const group = merged.filter(b => b.endMin > block.startMin && b.startMin < block.endMin);
      const maxCol = Math.max(...group.map(b => b.col)) + 1;
      for (const b of group) b.totalCols = Math.max(b.totalCols, maxCol);
    }
    return merged;
  }, [evBlocks, taskBlocks, habitBlocks]);

  // Per-layer blocks for desktop multi-column mode
  const layerColumns = useMemo(() => {
    if (!isMultiCol) return null;
    const layers = ['primary', 'operations', 'sacred'] as const;
    const layerLabels: Record<string, { label: string; icon: string }> = {
      primary: { label: 'Primary', icon: '📋' },
      operations: { label: 'Ops', icon: '⚙️' },
      sacred: { label: 'Sacred', icon: '✝' },
    };
    return layers.map(layer => {
      const blocks = allBlocks.filter((b: any) => {
        if (b._type === 'event') return (b.schedule_layer || 'primary') === layer;
        if (b._type === 'task') return layer === 'primary'; // tasks go to primary
        if (b._type === 'habit') return layer === 'primary'; // habits go to primary
        return false;
      });
      // Recalculate columns within each layer
      for (let i = 0; i < blocks.length; i++) {
        const overlapping = blocks.filter((b: any, j: number) => j < i && b.endMin > blocks[i].startMin && b.startMin < blocks[i].endMin);
        const usedCols = new Set(overlapping.map((b: any) => b.col));
        let col = 0;
        while (usedCols.has(col)) col++;
        blocks[i] = { ...blocks[i], col };
      }
      for (const block of blocks) {
        const group = blocks.filter((b: any) => b.endMin > block.startMin && b.startMin < block.endMin);
        const maxCol = Math.max(...group.map((b: any) => b.col)) + 1;
        for (const b of group) b.totalCols = Math.max(b.totalCols, maxCol);
      }
      return { layer, ...layerLabels[layer], blocks };
    }).filter(col => col.blocks.length > 0);
  }, [isMultiCol, allBlocks]);

  // ── Live event timeline position ──
  const liveBlock = useMemo(() => {
    if (!liveActiveEvent) return null;

    const startDate = new Date(liveActiveEvent.start_time);
    const startStr = localDateStr(startDate);
    // Only show on the day view if the live event started on the selected date
    if (startStr !== selStr) return null;

    const startMin = startDate.getHours() * 60 + startDate.getMinutes();
    const elapsedMin = Math.ceil(liveElapsedSeconds / 60);
    // Cap endMin at actual current time — never extend past "now"
    const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
    const rawEndMin = startMin + Math.max(elapsedMin, 5);
    const endMin = isTodaySel ? Math.min(rawEndMin, nowMinutes + 1) : rawEndMin;

    return { startMin, endMin, elapsedMin };
  }, [liveActiveEvent, liveElapsedSeconds, selStr]);

  // Adjust allBlocks columns when live event overlaps with scheduled items
  const adjustedAllBlocks = useMemo(() => {
    if (!liveBlock) return allBlocks;

    // Find scheduled items that overlap with the live event
    const overlapping = allBlocks.filter((item: any) => {
      // Don't count the live event itself if it shows up in scheduled events
      if (item._type === 'event' && liveActiveEvent && item.id === liveActiveEvent.id) return false;
      return item.endMin > liveBlock.startMin && item.startMin < liveBlock.endMin;
    });

    if (overlapping.length === 0) return allBlocks;

    // Reserve the right side for the live event: adjust overlapping items to left half
    return allBlocks.map((item: any) => {
      if (item._type === 'event' && liveActiveEvent && item.id === liveActiveEvent.id) {
        // Hide the regular rendering of the live event (we render it separately)
        return { ...item, _hiddenByLive: true };
      }
      const isOverlapping = overlapping.some((o: any) => o.id === item.id);
      if (isOverlapping) {
        return { ...item, col: item.col, totalCols: Math.max(item.totalCols, 2), _dimmable: true };
      }
      return item;
    });
  }, [allBlocks, liveBlock, liveActiveEvent]);

  // Live event column position (right side when overlapping, full width when not)
  const liveLayout = useMemo(() => {
    if (!liveBlock) return null;

    const hasOverlap = evBlocks.some(ev => {
      if (liveActiveEvent && ev.id === liveActiveEvent.id) return false;
      return ev.endMin > liveBlock.startMin && ev.startMin < liveBlock.endMin;
    });

    if (hasOverlap) {
      // Side-by-side: live event on right half
      return { leftPct: 10 + 43, widthPct: 43 };
    }
    // Full width (same as regular events)
    return { leftPct: 10, widthPct: 86 };
  }, [liveBlock, evBlocks, liveActiveEvent]);

  // Auto-scroll to keep the live event's growing edge visible (every 30s)
  useEffect(() => {
    if (!liveBlock || !timelineRef.current || view !== 'day') return;
    
    const scrollToLive = () => {
      if (!timelineRef.current || !liveBlock) return;
      const fh = showAllHours ? 0 : effectiveStart;
      const growingEdgePx = ((liveBlock.endMin / 60) - fh) * hourH;
      const container = timelineRef.current.parentElement;
      if (!container) return;
      
      const containerRect = container.getBoundingClientRect();
      const containerHeight = containerRect.height || window.innerHeight;
      const scrollTarget = growingEdgePx - containerHeight * 0.6;
      
      // Only scroll if the growing edge is out of view
      const currentScroll = container.scrollTop || window.scrollY;
      const edgeInView = growingEdgePx > currentScroll && growingEdgePx < currentScroll + containerHeight;
      
      if (!edgeInView) {
        window.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
      }
    };

    // Scroll on mount and every 30 seconds
    const timeout = setTimeout(scrollToLive, 500);
    const interval = setInterval(scrollToLive, 30000);
    
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [liveBlock, hourH, showAllHours, effectiveStart, view]);

  // Auto-scroll current time to upper third of viewport on load and every 60s
  const initialScrollDone = useRef(false);
  useEffect(() => {
    if (view !== 'day' || loading) return;
    if (!isTodaySel) { initialScrollDone.current = false; return; }

    const scrollToNow = (smooth: boolean) => {
      const now = new Date();
      const currentMin = now.getHours() * 60 + now.getMinutes();
      const fh = showAllHours ? 0 : effectiveStart;
      const nowPx = ((currentMin / 60) - fh) * hourH;
      // Target: position current time at ~15% from top of viewport
      const offset = nowPx - (window.innerHeight * 0.15);
      if (offset > 0) {
        window.scrollTo({ top: offset, behavior: smooth ? 'smooth' : 'auto' });
      }
    };

    // Initial scroll (instant, no jank)
    if (!initialScrollDone.current) {
      // Small delay to let DOM render
      const timeout = setTimeout(() => {
        scrollToNow(false);
        initialScrollDone.current = true;
      }, 300);
      return () => clearTimeout(timeout);
    }

    // Periodic scroll every 60s (smooth)
    const interval = setInterval(() => scrollToNow(true), 60000);
    return () => clearInterval(interval);
  }, [view, loading, isTodaySel, showAllHours, effectiveStart, hourH]);

  const nowMin = isTodaySel ? nowDate.getHours() * 60 + nowDate.getMinutes() : -1;
  const firstHour = showAllHours ? 0 : effectiveStart;

  // Check if any events exist outside the currently visible range
  const hasOutsideWaking = useMemo(() => {
    return events.some(ev => {
      const h = new Date(ev.start_time).getHours();
      return h < effectiveStart || h >= WAKE_END;
    });
  }, [events, effectiveStart]);

  // Today summary calculations
  const freeTime = calculateFreeTime(events, selectedDate);
  const nextEvent = getNextEvent(events);
  
  // Tomorrow preview
  const tomorrow = new Date(selectedDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = localDateStr(tomorrow);
  const tomorrowEvents = allEvents.filter(ev => {
    const evDate = new Date(ev.start_time);
    return localDateStr(evDate) === tomorrowStr;
  });

  // Week view: generate 7-day grid
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      days.push({
        date: d,
        iso: localDateStr(d),
        label: DAYS_SHORT[i],
        dayOfMonth: d.getDate(),
        isToday: localDateStr(d) === todayStr,
      });
    }
    return days;
  }, [weekStart, todayStr]);

  const weekEventsByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    weekDays.forEach(day => {
      const dayStart = `${day.iso}T00:00:00`;
      const dayEnd = `${day.iso}T23:59:59`;
      map[day.iso] = allEvents.filter(ev => {
        return ev.start_time && ev.start_time <= dayEnd && (ev.end_time ? ev.end_time > dayStart : ev.start_time >= dayStart);
      }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    });
    return map;
  }, [weekDays, allEvents]);

  // Long-press state for mobile
  // Long-press is now handled by touchDragTimer in handleSwipeStart (800ms → drag mode).
  // Detail view opens on normal tap (click handler), not on long-press.
  const longPressTimer = useRef<number | null>(null);
  const handleEventTouchStart = (_ev: ScheduleEvent) => {
    // No-op — drag timer is in handleSwipeStart
  };
  const handleEventTouchEnd = () => {
    // No-op — cleanup is in handleSwipeEnd
  };

  return (
    <div className="sched">
      {/* Header */}
      <ScheduleHeader
        view={view}
        selectedDate={selectedDate}
        calMonth={calMonth}
        calYear={calYear}
        isToday={isToday}
        weekStartDate={weekDays[0]?.date}
        onViewChange={setView}
        onDayShift={shiftDay}
        onWeekShift={shiftWeek}
        onMonthShift={shiftMonth}
        onGoToday={goToday}
        onShowForm={() => setShowForm(true)}
      />

      {/* Month Calendar View */}
      {view === 'month' && (
        <ScheduleMonthView
          year={calYear}
          month={calMonth}
          selectedDateStr={selStr}
          todayStr={todayStr}
          eventsByDay={eventsByDay}
          onDaySelect={selectCalDay}
          onGoToday={goToday}
        />
      )}

      {/* Week View */}
      {view === 'week' && (
        <ScheduleWeekView
          weekDays={weekDays}
          weekEventsByDay={weekEventsByDay}
          layerFilter={layerFilter}
          use24h={use24h}
          onDayClick={(date) => { setSelectedDate(date); setView('day'); }}
          onEventClick={(ev) => { setDetailEvent(ev); }}
          onEventContextMenu={(ev) => setDetailEvent(ev)}
        />
      )}

      {/* Day View */}
      {view === 'day' && (
        <>
          {/* Today Summary Card */}
          {isToday && (
            <div className="sched-today-summary glass-card">
              <div className="sts-row">
                <div className="sts-stat">
                  <span className="sts-label">Events Today</span>
                  <span className="sts-value">{events.length}</span>
                </div>
                {nextEvent && (
                  <div className="sts-stat next-event">
                    <span className="sts-label">Next Up</span>
                    <span className="sts-value">{nextEvent.title}</span>
                    <span className="sts-time">{timeStr(nextEvent.start_time, use24h)}</span>
                  </div>
                )}
                <div className="sts-stat">
                  <span className="sts-label">Free Time</span>
                  <span className="sts-value">{freeTime}h</span>
                </div>
                {tomorrowEvents.length > 0 && (
                  <div className="sts-stat">
                    <span className="sts-label">Tomorrow</span>
                    <span className="sts-value">{tomorrowEvents.length} event{tomorrowEvents.length !== 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Schedule Optimizer */}
          <ScheduleOptimizer selectedDate={selectedDate} />

          {/* Event form */}
          <BottomSheet
            open={showForm}
            onClose={() => { setShowForm(false); setAddingAtHour(null); }}
            title="New Event"
          >
              <div className="sched-form-date-label">
                {fmtDisplay(selectedDate)}
                {addingAtHour !== null && <span> at {fmtHourLabel(addingAtHour, use24h)}</span>}
              </div>
              <input autoFocus className="sched-form-input" placeholder="Event title..." value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && createEvent()} />
              
              <div className="sched-form-row">
                <div className="sched-form-group">
                  <label className="checkbox-label">
                    <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} />
                    All day event
                  </label>
                </div>
              </div>

              {!allDay && (
                <>
                  <div className="sched-form-row">
                    <div className="sched-form-group">
                      <TimePicker value={time} onChange={setTime} label="Start Time" />
                    </div>
                    <div className="sched-form-group">
                      <label>Duration</label>
                      <div className="sched-dur-pills">
                        {DURATIONS.map(d => (
                          <button key={d} className={`sched-dur-pill ${duration === d ? 'active' : ''}`} onClick={() => setDuration(d)}>
                            {d < 60 ? `${d}m` : d === 60 ? '1h' : `${d / 60}h`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Layer tabs */}
              <div className="sched-form-row">
                <div className="sched-form-group">
                  <label>Schedule Layer</label>
                  <div className="sched-layer-tabs">
                    {(['primary', 'operations', 'sacred'] as ScheduleLayer[]).map(layer => (
                      <button
                        key={layer}
                        className={`sched-layer-tab ${formLayer === layer ? 'active' : ''} sched-layer-tab--${layer}`}
                        onClick={() => {
                          setFormLayer(layer);
                          // Auto-select first type of the layer
                          const layerTypes = EVENT_TYPES.filter(t => t.layer === layer);
                          if (layerTypes.length > 0) {
                            setEventType(layerTypes[0].id);
                            setCategory(layer === 'primary' ? layerTypes[0].id : 'general');
                          }
                        }}
                      >
                        {layer === 'primary' ? <><ClipboardList size={12} /> Primary</> : layer === 'operations' ? <><Settings size={12} /> Operations</> : <><Cross size={12} /> Sacred</>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Event type selector (filtered by layer) */}
              <div className="sched-form-row">
                <div className="sched-form-group">
                  <label>Event Type</label>
                  <div className="sched-cat-pills">
                    {EVENT_TYPES.filter(t => t.layer === formLayer).map(t => (
                      <button
                        key={t.id}
                        className={`sched-cat-pill ${eventType === t.id ? 'active' : ''}`}
                        style={{ '--cat-color': t.color } as React.CSSProperties}
                        onClick={() => {
                          setEventType(t.id);
                          setCategory(t.id);
                        }}
                      >
                        <t.icon size={14} /> {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="sched-form-row">
                <div className="sched-form-group">
                  <label>Priority</label>
                  <div className="sched-cat-pills">
                    {PRIORITIES.map(p => (
                      <button key={p.id} className={`sched-cat-pill ${eventPriority === p.id ? 'active' : ''}`} style={{ '--cat-color': p.color } as React.CSSProperties} onClick={() => setEventPriority(p.id)}>{p.label}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="sched-form-row">
                <div className="sched-form-group">
                  <label>Link to Goal (optional)</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <select className="sched-form-select" value={eventObjective} onChange={e => { setEventObjective(e.target.value); setEventEpic(''); setEventGoal(''); }}>
                      <option value="">Select Objective</option>
                      {objectives.map((o: ScheduleGoal) => <option key={o.id} value={o.id}>{o.title}</option>)}
                    </select>
                    {eventObjective && (
                      <select className="sched-form-select" value={eventEpic} onChange={e => { setEventEpic(e.target.value); setEventGoal(''); }}>
                        <option value="">Select Epic</option>
                        {epics.map((ep: ScheduleGoal) => <option key={ep.id} value={ep.id}>{ep.title}</option>)}
                      </select>
                    )}
                    {eventEpic && (
                      <select className="sched-form-select" value={eventGoal} onChange={e => setEventGoal(e.target.value)}>
                        <option value="">Select Goal</option>
                        {linkableGoals.map((g: ScheduleGoal) => <option key={g.id} value={g.id}>{g.title}</option>)}
                      </select>
                    )}
                  </div>
                </div>
              </div>
              <input className="sched-form-input small" placeholder="Notes (optional)" value={desc} onChange={e => setDesc(e.target.value)} />
              {error && <ErrorCard message={error} />}
              <div className="sched-form-actions">
                <button className="sched-form-cancel" onClick={() => { setShowForm(false); setAddingAtHour(null); }}>Cancel</button>
                <button className="sched-form-save" onClick={createEvent} disabled={saving || !title.trim()}>
                  {saving ? <><Loader2 size={14} className="spin" /> Saving...</> : 'Create Event'}
                </button>
              </div>
          </BottomSheet>

          {loading ? <ScheduleSkeleton /> : (
            <div className="sched-day-layout">

              {/* Compact Day Context */}
              <div className={`sched-day-context ${contextCollapsed ? 'collapsed' : ''}`}>
                <div className="sched-context-header" onClick={() => setContextCollapsed(!contextCollapsed)}>
                  <div className="sched-day-pills">
                    <span className="sd-pill"><CheckCircle2 size={11} /> {dayDoneTasks.length}/{dayTasks.length} tasks</span>
                    <span className="sd-pill"><Flame size={11} /> {dayHabitsDone}/{habits.length} habits</span>
                    {dayBills.length > 0 && <span className="sd-pill bill"><Receipt size={11} /> {dayBills.length} bill{dayBills.length !== 1 ? 's' : ''} · ${dayBills.reduce((s: number, b: ScheduleBill) => s + b.amount, 0).toFixed(0)}</span>}
                    <span className="sd-pill"><Clock size={11} /> {events.length} event{events.length !== 1 ? 's' : ''}</span>
                  </div>
                  <button aria-label="Toggle day context" className="sched-context-toggle" title={contextCollapsed ? 'Expand' : 'Collapse'}>
                    {contextCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </button>
                </div>

                <div className="sched-context-body">
                  {dayBills.length > 0 && (
                    <div className="sched-day-section">
                      <div className="sched-day-label"><Receipt size={11} /> Bills Due</div>
                      {dayBills.map((b: ScheduleBill) => (
                        <div key={b.id} className="sd-item sd-bill">
                          <span className="sd-icon"><DollarSign size={14} /></span>
                          <span className="sd-title">{b.title}</span>
                          <span className="sd-tag bill">${b.amount}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {dayTasks.length > 0 && (
                    <div className="sched-day-section">
                      <div className="sched-day-label"><Target size={11} /> Tasks</div>
                      {dayActiveTasks.map(t => {
                        const chain = getChain(t.goal_id);
                        return (
                          <div key={t.id} className="sd-item sd-task">
                            <button className="sd-chk" onClick={() => toggleTask(t.id, t.status)} aria-label="Mark task complete"><Circle size={15} /></button>
                            <div className="sd-task-info">
                              <span className="sd-title" onClick={() => setDetailTaskId(t.id)} style={{ cursor: 'pointer' }}>{t.title}</span>
                              {chain && <span className="sd-chain">{chain}</span>}
                            </div>
                            {t.priority && <span className="sd-tag" data-priority={t.priority}>{t.priority}</span>}
                          </div>
                        );
                      })}
                      {dayDoneTasks.length > 0 && (
                        <details className="sd-done-group">
                          <summary className="sd-done-toggle">✓ {dayDoneTasks.length} completed</summary>
                          {dayDoneTasks.map(t => (
                            <div key={t.id} className="sd-item sd-task done">
                              <button className="sd-chk checked" onClick={() => toggleTask(t.id, t.status)} aria-label="Mark task incomplete"><CheckCircle2 size={15} /></button>
                              <span className="sd-title">{t.title}</span>
                            </div>
                          ))}
                        </details>
                      )}
                    </div>
                  )}

                  {habits.length > 0 && (
                    <div className="sched-day-section">
                      <div className="sched-day-label"><Flame size={11} /> Habits</div>
                      <div className="sd-habits-grid">
                        {habits.map(h => {
                          const hLogs = dayHabitLogs.filter(l => l.habit_id === h.id);
                          const done = hLogs.reduce((s: number, l: HabitLog) => s + (l.count || 1), 0) >= (h.target_count || 1);
                          return (
                            <div key={h.id} className={`sd-habit ${done ? 'done' : ''}`} onClick={() => toggleHabit(h.id)}>
                              <span className="sd-habit-icon"><EmojiIcon emoji={h.icon || '💪'} size={16} fallbackAsText /></span>
                              <span className="sd-habit-name">{h.title}</span>
                              <div className={`sd-habit-chk ${done ? 'checked' : ''}`}>{done ? <CheckCircle2 size={14} /> : <Circle size={14} />}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Events section — list events like tasks/habits */}
                  {filteredEvents.length > 0 && (
                    <div className="sched-day-section">
                      <div className="sched-day-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span><Clock size={11} /> Events ({filteredEvents.length})</span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {undoStack.length > 0 && (
                            <button className="sd-mass-action" onClick={undoLastDelete} title="Undo last delete" style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(57,255,20,0.08)', border: '1px solid rgba(57,255,20,0.2)', borderRadius: 4, color: '#39FF14', cursor: 'pointer' }}>
                              Undo
                            </button>
                          )}
                          <button className="sd-mass-action" onClick={() => confirmDelete('Clear all events', `Delete all ${filteredEvents.filter(e => !(e as any).is_google).length} events for this day?`, massDeleteDayEvents)} title="Delete all events for this day" style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 4, color: '#F43F5E', cursor: 'pointer' }}>
                            Clear All
                          </button>
                        </div>
                      </div>
                      {filteredEvents.slice(0, 10).map((ev: any) => (
                        <div key={ev.id} className="sd-item sd-event" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="sd-title" onClick={() => setDetailEvent(ev)} style={{ flex: 1, cursor: 'pointer', fontSize: 12 }}>{ev.title}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {ev.start_time ? new Date(ev.start_time).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }) : ''}
                          </span>
                          {!(ev as any).is_google && (
                            <button onClick={() => deleteEvent(ev.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, opacity: 0.5 }} title="Delete">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                      {filteredEvents.length > 10 && <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '4px 0' }}>+{filteredEvents.length - 10} more</div>}
                    </div>
                  )}
                </div>
              </div>

              <div className="sched-day-main">
              {/* Layer toggle buttons */}
              <div className="sched-layer-filter">
                {([
                  { id: 'all' as LayerFilter, label: 'All', icon: <ClipboardList size={12} /> },
                  { id: 'primary' as LayerFilter, label: 'Primary', icon: <ClipboardList size={12} /> },
                  { id: 'operations' as LayerFilter, label: 'Ops', icon: <Settings size={12} /> },
                  { id: 'sacred' as LayerFilter, label: 'Sacred', icon: <Cross size={12} /> },
                ] as { id: LayerFilter; label: string; icon: React.ReactNode }[]).map(lf => (
                  <button
                    key={lf.id}
                    className={`sched-layer-filter-btn ${layerFilter === lf.id ? 'active' : ''} sched-layer-filter-btn--${lf.id}`}
                    onClick={() => setLayerFilterPersist(lf.id)}
                  >
                    <span>{lf.icon}</span>
                    <span>{lf.label}</span>
                  </button>
                ))}
              </div>

              {/* Timeline controls */}
              <div className="sched-timeline-controls">
                <div className="stc-left">
                  <button
                    className={`stc-btn ${showAllHours ? 'active' : ''}`}
                    onClick={() => setShowAllHours(!showAllHours)}
                    title={showAllHours ? 'Show waking hours (6AM–11PM)' : 'Show all 24 hours'}
                  >
                    <Sun size={13} />
                    <span>{showAllHours ? '24h' : '6–23'}</span>
                  </button>
                  <button
                    className="sched-toolbar-btn"
                    onClick={toggleTimeFormat}
                    title={use24h ? 'Switch to 12-hour format' : 'Switch to 24-hour format'}
                  >
                    <Clock size={14} />
                    <span>{use24h ? '24h' : '12h'}</span>
                  </button>
                  {hasOutsideWaking && !showAllHours && (
                    <span className="stc-hint">Events outside visible hours</span>
                  )}
                </div>
                {junctionEquipped && spiritualLevel > 0 && (
                  <span
                    className="stl-sacred-ring"
                    title={`${junctionTradition?.name || 'Junction'} — Level ${junctionLevel} — ${Math.round(overlayOpacity * 100)}% influence`}
                  >
                    <svg width="22" height="22" viewBox="0 0 22 22">
                      <circle cx="11" cy="11" r="9" fill="none" stroke="rgba(168,85,247,0.15)" strokeWidth="2.5" />
                      <circle
                        cx="11" cy="11" r="9"
                        fill="none"
                        stroke="#A855F7"
                        strokeWidth="2.5"
                        strokeDasharray={`${Math.round(overlayOpacity * 100 * 0.565)} 56.5`}
                        strokeLinecap="round"
                        transform="rotate(-90 11 11)"
                        style={{ transition: 'stroke-dasharray 0.5s ease' }}
                      />
                      <text x="11" y="11.5" textAnchor="middle" dominantBaseline="central" fill="#A855F7" fontSize="7" fontWeight="700">
                        {Math.round(overlayOpacity * 100)}
                      </text>
                    </svg>
                  </span>
                )}
              </div>

              {/* Hourly Timeline */}
              <div
                className={`sched-timeline ${dragId ? 'dragging' : ''} ${isMultiCol && layerColumns && layerColumns.length > 1 ? 'sched-timeline--multi-col' : ''}`}
                ref={timelineRef}
                style={{ position: 'relative', minHeight: hours.length * hourH }}
                onDragOver={handleTimelineDragOver}
                onDrop={handleTimelineDrop}
                onDragLeave={() => { setDragGhostTop(null); setDropHour(null); }}
              >
                {hours.map((h, idx) => {
                  const label = fmtHourLabel(h, use24h);
                  const top = idx * hourH;
                  const isPast = isTodaySel && nowDate.getHours() > h;
                  const isDropTarget = dropHour === h;
                  return (
                    <div key={h} className={`stl-hour ${isPast ? 'past' : ''} ${isDropTarget ? 'drop-target' : ''}`} style={{ top, height: hourH }}>
                      <span className="stl-label">{label}</span>
                      <div className="stl-line" />
                      <button className="stl-add" onClick={() => openAddAtHour(h)} title="Add event" aria-label="Add event"><Plus size={12} /></button>
                    </div>
                  );
                })}

                {/* Now indicator */}
                {nowMin >= 0 && (() => {
                  const nowOffset = ((nowMin / 60) - firstHour) * hourH;
                  if (nowOffset < 0 || nowOffset > hours.length * hourH) return null;
                  return (
                    <div className="stl-now" style={{ top: nowOffset }}>
                      <div className="stl-now-dot" />
                      <div className="stl-now-line" />
                    </div>
                  );
                })()}

                {/* Drop indicator line */}
                {dragGhostTop !== null && (
                  <div className="stl-drop-indicator" style={{ top: dragGhostTop }} />
                )}

                {/* Multi-column layer headers + dividers (desktop only) */}
                {isMultiCol && layerColumns && layerColumns.length > 1 && (() => {
                  const nCols = layerColumns.length;
                  const colWidthPct = 86 / nCols;
                  return (
                    <>
                      {layerColumns.map((col, i) => {
                        const colLeft = 10 + i * colWidthPct;
                        return (
                          <div key={`hdr-${col.layer}`} className="sched-col-header" style={{ position: 'absolute', top: -28, left: `${colLeft}%`, width: `${colWidthPct}%`, zIndex: 15 }}>
                            <span>{col.icon}</span> {col.label}
                          </div>
                        );
                      })}
                      {layerColumns.slice(1).map((col, i) => {
                        const divLeft = 10 + (i + 1) * colWidthPct;
                        return (
                          <div key={`div-${col.layer}`} className="sched-col-divider" style={{ position: 'absolute', top: 0, bottom: 0, left: `${divLeft}%`, width: 1, background: 'rgba(255,255,255,0.06)', zIndex: 4 }} />
                        );
                      })}
                    </>
                  );
                })()}

                {/* Event, Task, and Habit blocks */}
                {adjustedAllBlocks.map((item: any) => {
                  // Skip if hidden by live event (rendered separately)
                  if (item._hiddenByLive) return null;

                  const topPx = ((item.startMin / 60) - firstHour) * hourH;
                  const rawHeight = ((item.endMin - item.startMin) / 60) * hourH;
                  const isResizing = item._type === 'event' && resizeId === item.id;
                  const isSwiping = item._type === 'event' && swipeId === item.id;
                  const height = Math.max(isResizing && resizeH !== null ? resizeH : rawHeight, 40);

                  // Multi-column: position blocks within their layer's column
                  let leftPct: number;
                  let widthPct: number;
                  if (isMultiCol && layerColumns && layerColumns.length > 1) {
                    const itemLayer = item._type === 'event' ? (item.schedule_layer || 'primary') : 'primary';
                    const colIdx = layerColumns.findIndex(c => c.layer === itemLayer);
                    const nCols = layerColumns.length;
                    const colWidthPct = 86 / nCols;
                    const colLeft = 10 + (colIdx >= 0 ? colIdx : 0) * colWidthPct;
                    leftPct = colLeft + (item.col / item.totalCols) * colWidthPct;
                    widthPct = (1 / item.totalCols) * colWidthPct;
                  } else {
                    leftPct = 10 + (item.col / item.totalCols) * 86;
                    widthPct = (1 / item.totalCols) * 86;
                  }
                  const durationMin = item.endMin - item.startMin;
                  const isShort = durationMin <= 15 || height < 46;
                  const isDragging = item._type === 'event' && dragId === item.id;
                  const isTouchDragging = item._type === 'event' && touchDragId === item.id && touchDragActive.current;
                  const isDimmedByLive = item._dimmable;
                  const isGoogleEvent = item._type === 'event' && item.source === 'google';
                  const evLayer = item._type === 'event' ? (item.schedule_layer || 'primary') : 'primary';
                  const isSacred = evLayer === 'sacred';
                  const isOps = evLayer === 'operations';
                  const isTask = item._type === 'task';
                  const isHabit = item._type === 'habit';

                  if (!showAllHours && (item.startMin / 60 < effectiveStart || item.startMin / 60 >= WAKE_END)) return null;

                  // Render tasks
                  if (isTask) {
                    return (
                      <div
                        key={`task-${item.id}`}
                        data-task-id={item.id}
                        className="stl-event stl-event--task"
                        style={{
                          top: topPx,
                          height,
                          left: `${leftPct}%`,
                          width: `calc(${widthPct}% - 4px)`,
                          '--ev-color': item.priority === 'urgent' ? '#F43F5E' : item.priority === 'high' ? '#F97316' : '#00D4FF',
                          borderLeft: `3px solid var(--ev-color)`,
                          background: 'rgba(0,212,255,0.08)',
                        } as React.CSSProperties}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailTaskId(item.id);
                        }}
                      >
                        <span className="stl-ev-title">
                          <Circle size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                          {item.title}
                        </span>
                        {!isShort && <span className="stl-ev-time" style={{ fontSize: 10, opacity: 0.6 }}>Due today</span>}
                      </div>
                    );
                  }

                  // Render habits
                  if (isHabit) {
                    return (
                      <div
                        key={`habit-${item.id}`}
                        className={`stl-event stl-event--habit ${item._isDone ? 'stl-event--habit-done' : ''}`}
                        style={{
                          top: topPx,
                          height,
                          left: `${leftPct}%`,
                          width: `calc(${widthPct}% - 4px)`,
                          '--ev-color': item._isDone ? '#39FF14' : '#F97316',
                          borderLeft: `3px solid var(--ev-color)`,
                          background: item._isDone ? 'rgba(57,255,20,0.08)' : 'rgba(249,115,22,0.08)',
                        } as React.CSSProperties}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleHabit(item.id);
                        }}
                      >
                        <span className="stl-ev-title">
                          {item._isDone ? <CheckCircle2 size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /> : <Flame size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                          <EmojiIcon emoji={item.icon || '💪'} size={14} fallbackAsText /> {item.title}
                        </span>
                        {!isShort && <span className="stl-ev-time" style={{ fontSize: 10, opacity: 0.6 }}>{item._isDone ? 'Completed' : 'Daily habit'}</span>}
                      </div>
                    );
                  }

                  // Render events (original code)
                  const ev = item;

                  return (
                    <div
                      key={ev.id}
                      data-event-id={ev.id}
                      className={`stl-event ${ev.status === 'completed' ? 'stl-event--completed' : ''} ${isDragging ? 'is-dragging' : ''} ${isTouchDragging ? 'is-touch-dragging' : ''} ${isResizing ? 'is-resizing' : ''} ${isSwiping ? 'is-swiping' : ''} ${isDimmedByLive ? 'is-live-overlap' : ''} ${isSacred ? 'stl-event--sacred' : ''} ${isOps ? 'stl-event--ops' : ''} ${isGoogleEvent ? 'stl-event--google' : ''} ${ev._continuesFromBefore ? 'stl-event--cont-top' : ''} ${ev._continuesAfter ? 'stl-event--cont-bottom' : ''}`}
                      draggable={!isGoogleEvent && ev.status !== 'completed'}
                      onDragStart={(e) => handleDragStart(e, ev.id)}
                      onDragEnd={handleDragEnd}
                      onTouchStart={(e) => {
                        handleEventTouchStart(ev);
                        handleSwipeStart(e, ev.id);
                      }}
                      onTouchMove={(e) => {
                        handleEventTouchEnd();
                        handleSwipeMove(e);
                      }}
                      onTouchEnd={() => {
                        handleEventTouchEnd();
                        handleSwipeEnd();
                      }}
                      style={{
                        top: isTouchDragging && touchDragTopPx !== null ? touchDragTopPx : topPx,
                        height,
                        left: `${leftPct}%`,
                        width: `calc(${widthPct}% - 4px)`,
                        '--ev-color': ev.color || '#64748B',
                        transform: isSwiping && !isTouchDragging ? `translateX(${swipeX}px)` : undefined,
                        transition: isSwiping && swipeX === 0 ? 'transform 0.2s ease-out' : undefined,
                        zIndex: isTouchDragging ? 100 : undefined,
                        opacity: isTouchDragging ? 0.85 : undefined,
                        boxShadow: isTouchDragging ? '0 4px 20px rgba(0,0,0,0.3)' : undefined,
                      } as React.CSSProperties}
                      onClick={(e) => {
                        if (!isDragging && !isResizing && !isSwiping && !isTouchDragging && !touchDragJustEnded.current) {
                          setDetailEvent(ev);
                        }
                        e.stopPropagation();
                      }}
                    >
                      {ev._continuesFromBefore && <span className="stl-ev-cont">← continues from {localDateStr(new Date(ev.start_time))}</span>}
                      <span className="stl-ev-title">{isGoogleEvent ? '📅 ' : ''}{ev.title}</span>
                      {!isShort && <span className="stl-ev-time">{timeStr(ev.start_time, use24h)} – {timeStr(ev.end_time, use24h)}</span>}
                      {!isShort && ev._continuesAfter && <span className="stl-ev-cont">continues to {localDateStr(new Date(ev.end_time))} →</span>}
                      {!isShort && !isGoogleEvent && (() => {
                        const evStart = new Date(ev.start_time).getTime();
                        const evEnd = new Date(ev.end_time).getTime();
                        const nowMs = Date.now();
                        const isFocusable = nowMs >= evStart - 15 * 60 * 1000 && nowMs < evEnd;
                        return (
                          <button
                            className={`stl-ev-play ${isFocusable ? 'stl-ev-play--focus' : ''}`}
                            onClick={(e) => { e.stopPropagation(); startOverlay({ ...ev, description: ev.description ?? undefined, color: ev.color ?? undefined, day_type: ev.day_type ?? undefined }); }}
                            title={isFocusable ? 'Start Focus Mode' : 'Start Event Overlay'}
                          >
                            <Play size={10} />
                            {isFocusable && <span className="stl-ev-play-label">Focus</span>}
                          </button>
                        );
                      })()}
                      <div
                        className="stl-resize-handle"
                        onPointerDown={(e) => handleResizeStart(e, ev.id, height)}
                        onPointerMove={handleResizeMove}
                        onPointerUp={handleResizeEnd}
                        onClick={(e) => e.stopPropagation()}
                      />
                      {isSwiping && swipeX < -20 && (
                        <div className="stl-delete-reveal">
                          <Trash2 size={16} />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Sacred Schedule Overlay — spiritual practice blocks */}
                {junctionEquipped && sacredBlocks.length > 0 && sacredBlocks.map(sb => {
                  const topPx = ((sb.startMin / 60) - firstHour) * hourH;
                  const heightPx = Math.max(((sb.endMin - sb.startMin) / 60) * hourH, 20);
                  // Don't render blocks outside visible range
                  if (!showAllHours && (sb.startMin / 60 < effectiveStart || sb.startMin / 60 >= WAKE_END)) return null;
                  const isFasting = sb.category === 'fasting';
                  const isHighLevel = spiritualLevel > 0.5;

                  return (
                    <div
                      key={sb.id}
                      className={`stl-sacred-block stl-sacred-glow ${isFasting ? 'stl-sacred-fasting' : ''} ${isHighLevel ? 'stl-sacred-visible' : ''}`}
                      style={{
                        top: topPx,
                        height: heightPx,
                        left: `${sacredLayout.leftPct}%`,
                        width: `${sacredLayout.widthPct}%`,
                        '--sacred-opacity': overlayOpacity,
                        '--sacred-glow': glowIntensity,
                      } as React.CSSProperties}
                      title={`${sb.icon} ${sb.name}`}
                    >
                      <span className="stl-sacred-label">
                        <span className="stl-sacred-icon">{sb.icon}</span>
                        {sb.name}
                      </span>
                    </div>
                  );
                })}

                {/* Live Event Block — grows from start time to current time */}
                {liveActiveEvent && liveBlock && liveLayout && (() => {
                  // Calculate pixel positions — clamp endMin to current time
                  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
                  const clampedEndMin = Math.min(liveBlock.endMin, nowMinutes + 1);
                  const topPx = Math.max(0, ((liveBlock.startMin / 60) - firstHour) * hourH);
                  const bottomPx = ((clampedEndMin / 60) - firstHour) * hourH;
                  const heightPx = Math.max(bottomPx - topPx, 48); // minimum visible height

                  return (
                    <>
                      <LiveTimelineEvent
                        event={liveActiveEvent}
                        elapsedSeconds={liveElapsedSeconds}
                        metadata={liveMetadata}
                        topPx={topPx}
                        heightPx={heightPx}
                        leftPct={liveLayout.leftPct}
                        widthPct={liveLayout.widthPct}
                        use24h={use24h}
                        onClick={() => {
                          setDetailEvent({
                            id: liveActiveEvent.id,
                            title: liveActiveEvent.title,
                            start_time: liveActiveEvent.start_time,
                            end_time: liveActiveEvent.end_time || new Date().toISOString(),
                            color: liveActiveEvent.color,
                            location: liveActiveEvent.location,
                            status: liveActiveEvent.status,
                            is_live: true,
                            metadata: liveActiveEvent.metadata,
                          });
                        }}
                      />
                    </>
                  );
                })()}
              </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Unified Timeline View */}
      {view === 'timeline' && (
        <UnifiedTimeline date={selectedDate} />
      )}

      {/* Quick Add Button removed from FAB — now in header */}

      {/* EventDetail Modal */}
      {detailEvent && (
        <EventDetail
          // @ts-expect-error - detailEvent is Partial<ScheduleEvent> but EventDetail expects full type
          event={detailEvent}
          onClose={() => setDetailEvent(null)}
          onUpdate={() => {
            if (view === 'day') fetchDayEvents();
            else if (view === 'week') fetchWeekEvents();
            else fetchMonthEvents();
            setDetailEvent(null);
          }}
        />
      )}

      {/* TaskDetail Modal */}
      {detailTaskId && (
        <TaskDetail
          taskId={detailTaskId}
          allGoals={goals}
          allTasks={tasks}
          onClose={() => setDetailTaskId(null)}
        />
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmMsg.title}
        message={confirmMsg.message}
        onConfirm={() => {
          confirmAction?.();
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />

      <SpotlightTour tourId="schedule" />
    </div>
  );
}
