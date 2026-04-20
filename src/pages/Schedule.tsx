/**
 * Schedule — Page orchestrator (<300 lines)
 *
 * Composes subcomponents for each view:
 * - ScheduleHeader, ScheduleMonthView, ScheduleWeekView
 * - ScheduleDayView  (day layout: summary, optimizer, context, timeline)
 * - ScheduleBoardView (kanban), UnifiedTimeline
 * Plus modals: EventDetail, TaskDetail, ConfirmDialog, SpotlightTour
 */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useUserStore } from '../stores/useUserStore';
import { useScheduleStore } from '../stores/useScheduleStore';
import { useHabitsStore } from '../stores/useHabitsStore';
import type { HabitLog } from '../stores/useHabitsStore';
import { useFinanceStore } from '../stores/useFinanceStore';
import { useGoalsStore } from '../stores/useGoalsStore';
import { useLiveActivityStore } from '../stores/useLiveActivityStore';
import { supabase } from '../lib/data-access';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EventDetail } from '../components/EventDetail';
import { useEventOverlay } from '../components/EventOverlay';
import { showToast } from '../components/Toast';
import { TaskDetail } from '../components/TaskDetail';
import { ScheduleHeader } from '../components/schedule/ScheduleHeader';
import { ScheduleMonthView } from '../components/schedule/ScheduleMonthView';
import { ScheduleWeekView } from '../components/schedule/ScheduleWeekView';
import { ScheduleDayView } from '../components/schedule/ScheduleDayView';
import { ScheduleBoardView } from '../components/schedule/ScheduleBoardView';
import { UnifiedTimeline } from '../components/schedule/UnifiedTimeline';
import { SpotlightTour } from '../components/SpotlightTour';
import { ScheduleSkeleton } from '../components/skeletons';
import { localDateStr } from '../utils/date';
import { type ScheduleLayer, type EventType } from '../lib/schedule-events';
import { useSacredSchedule } from '../hooks/useSacredSchedule';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';
import { useScheduleDragHandlers } from '../components/schedule/useScheduleDragHandlers';
import { useScheduleEffects } from '../components/schedule/useScheduleEffects';
import { useScheduleTimelineData } from '../components/schedule/useScheduleTimelineData';
import { DEFAULT_HOUR_H, DAYS_SHORT, getMonthGrid, WAKE_END } from '../components/schedule/utils';
import type { ScheduleEvent as ScheduleEventType, ScheduleTask, ScheduleHabit, ScheduleBill, ScheduleGoal, LayerFilter, ViewType } from '../components/schedule/types';
import './Schedule.css';

type ScheduleEvent = ScheduleEventType;

export function Schedule() {
  const user = useUserStore(s => s.user);
  const { startOverlay } = useEventOverlay();

  // ── State ──
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [allEvents, setAllEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState<ViewType>('day');
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [error, setError] = useState('');
  const [layerFilter, setLayerFilter] = useState<LayerFilter>(() => { try { return (localStorage.getItem('lifeos-schedule-layer') as LayerFilter) || 'all'; } catch { return 'all'; } });
  const [isDesktopWide, setIsDesktopWide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1200);
  const [title, setTitle] = useState(''); const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(60); const [category, setCategory] = useState('general');
  const [eventType, setEventType] = useState<EventType>('general'); const [formLayer, setFormLayer] = useState<ScheduleLayer>('primary');
  const [desc, setDesc] = useState(''); const [allDay, setAllDay] = useState(false);
  const [saving, setSaving] = useState(false); const [addingAtHour, setAddingAtHour] = useState<number | null>(null);
  const [eventObjective, setEventObjective] = useState(''); const [eventEpic, setEventEpic] = useState('');
  const [eventGoal, setEventGoal] = useState(''); const [eventPriority, setEventPriority] = useState('medium');
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [detailEvent, setDetailEvent] = useState<Partial<ScheduleEvent> & { id: string; title: string; start_time: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMsg, setConfirmMsg] = useState({ title: '', message: '' });
  const [contextCollapsed, setContextCollapsed] = useState(true);
  const [hourH, setHourH] = useState(DEFAULT_HOUR_H);
  const [showAllHours, setShowAllHours] = useState(true);
  const [use24h, setUse24h] = useState(() => { try { return localStorage.getItem('lifeos-schedule-24h') === 'true'; } catch { return false; } });
  const [weekStart, setWeekStart] = useState(() => { const t = new Date(); const d = t.getDay(); const diff = d === 0 ? -6 : 1 - d; const m = new Date(t); m.setDate(t.getDate() + diff); return m; });
  const [undoStack, setUndoStack] = useState<Array<{ id: string; title: string }>>([]);

  // ── Stores ──
  const tasks = useScheduleStore(s => s.tasks) as unknown as ScheduleTask[];
  const goals = useGoalsStore(s => s.goals) as unknown as ScheduleGoal[];
  const habits = useHabitsStore(s => s.habits) as unknown as ScheduleHabit[];
  const habitLogs = useHabitsStore(s => s.logs) as HabitLog[];
  const bills = useFinanceStore(s => s.bills) as unknown as ScheduleBill[];
  const liveActiveEvent = useLiveActivityStore(s => s.activeEvent);
  const liveElapsedSeconds = useLiveActivityStore(s => Math.floor(s.elapsedSeconds / 30) * 30);
  const liveMetadata = useLiveActivityStore(s => s.metadata);
  const { googleEvents } = useGoogleCalendar();
  const { sacredBlocks, overlayOpacity, isEquipped: junctionEquipped, spiritualLevel, tradition: junctionTradition, sacredLayout, glowIntensity } = useSacredSchedule();
  const junctionLevel = useMemo(() => { const xp = spiritualLevel * 12000; if (xp >= 12000) return 7; if (xp >= 8000) return 6; if (xp >= 5000) return 5; if (xp >= 3000) return 4; if (xp >= 1500) return 3; if (xp >= 500) return 2; if (xp > 0) return 1; return 0; }, [spiritualLevel]);
  const isMultiCol = isDesktopWide && layerFilter === 'all';

  // ── Derived ──
  const todayStr = localDateStr(new Date()); const selStr = localDateStr(selectedDate); const isToday = selStr === todayStr; const isTodaySel = selStr === localDateStr(new Date());
  const setLayerFilterPersist = (lf: LayerFilter) => { setLayerFilter(lf); try { localStorage.setItem('lifeos-schedule-layer', lf); } catch {} };
  const toggleTimeFormat = () => { setUse24h(prev => { const next = !prev; try { localStorage.setItem('lifeos-schedule-24h', String(next)); } catch {} return next; }); };

  const confirmDelete = (title: string, message: string, action: () => void) => { setConfirmMsg({ title, message }); setConfirmAction(() => action); };
  const deleteEvent = async (id: string) => {
    const deletedEvent = events.find(e => e.id === id); const prevEvents = [...events];
    useScheduleStore.setState({ events: events.filter(e => e.id !== id) }); setConfirmAction(null); setDetailEvent(null);
    if (deletedEvent) { setUndoStack(prev => [...prev, { id, title: deletedEvent.title || 'Event' }]); showToast(`Deleted "${deletedEvent.title}"`, '🗑️', '#F43F5E'); }
    try { await supabase.from('schedule_events').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', id); } catch { useScheduleStore.setState({ events: prevEvents }); showToast('Failed to delete event', '⚠️', '#F43F5E'); }
  };
  const undoLastDelete = async () => {
    const last = undoStack[undoStack.length - 1]; if (!last) return; setUndoStack(prev => prev.slice(0, -1));
    await supabase.from('schedule_events').update({ is_deleted: false, updated_at: new Date().toISOString() }).eq('id', last.id);
    if (view === 'day' || view === 'timeline') fetchDayEvents(); else if (view === 'week') fetchWeekEvents(); else fetchMonthEvents();
    showToast(`Restored "${last.title}"`, '↩️', '#39FF14');
  };
  const filteredEvents = useMemo(() => {
    let base = layerFilter === 'all' ? events : events.filter(ev => (ev.schedule_layer || 'primary') === layerFilter);
    const selDateStr = localDateStr(selectedDate);
    const googleForDay = googleEvents.filter(ge => ge.date === selDateStr).map(ge => ({ ...ge, user_id: user?.id || '', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), schedule_layer: 'primary' as const })) as unknown as ScheduleEvent[];
    return [...base, ...googleForDay];
  }, [events, layerFilter, googleEvents, selectedDate, user?.id]);
  const massDeleteDayEvents = async () => {
    const dayEvs = filteredEvents.filter(e => e.source !== 'google'); if (dayEvs.length === 0) return;
    const prevEvents = [...events]; const dayIds = new Set(dayEvs.map(e => e.id));
    useScheduleStore.setState({ events: events.filter(e => !dayIds.has(e.id)) }); showToast(`Deleted ${dayEvs.length} events`, '🗑️', '#F43F5E');
    try { await supabase.from('schedule_events').update({ is_deleted: true, updated_at: new Date().toISOString() }).in('id', dayEvs.map(e => e.id)); } catch { useScheduleStore.setState({ events: prevEvents }); showToast('Failed to delete events', '⚠️', '#F43F5E'); }
  };
  const toggleTask = async (id: string, status: string) => { await useScheduleStore.getState().changeTaskStatus(id, status === 'done' ? 'pending' : 'done'); fetchDayEvents(); };
  const toggleHabit = async (habitId: string) => { await useHabitsStore.getState().toggleHabit(habitId, selStr); };

  // Day context data
  const dayTasks = useMemo(() => tasks.filter(t => { if (t.due_date === selStr) return true; if (t.completed_at && t.completed_at.startsWith(selStr)) return true; if (!t.due_date && isTodaySel && t.status !== 'done') return true; return false; }), [tasks, selStr, isTodaySel]);
  const dayHabitLogs = useMemo(() => habitLogs.filter(l => l.date === selStr), [habitLogs, selStr]);
  const dayBills = useMemo(() => bills.filter(b => b.due_date === selStr && b.status !== 'paid'), [bills, selStr]);
  const dayActiveTasks = dayTasks.filter(t => t.status !== 'done'); const dayDoneTasks = dayTasks.filter(t => t.status === 'done');
  const dayHabitsDone = useMemo(() => habits.filter(h => { const hL = dayHabitLogs.filter(l => l.habit_id === h.id); return hL.reduce((s: number, l: HabitLog) => s + (l.count || 1), 0) >= (h.target_count || 1); }).length, [habits, dayHabitLogs]);
  const getChain = useCallback((goalId: string | null): string => { if (!goalId) return ''; const chain: string[] = []; let cur: string | null = goalId; while (cur) { const g = goals.find((x: ScheduleGoal) => x.id === cur); if (!g) break; chain.unshift(g.title); cur = g.parent_goal_id; } return chain.join(' › '); }, [goals]);

  // ── Timeline data (extracted hook) ──
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineData = useScheduleTimelineData({
    events, allEvents, selectedDate, layerFilter, googleEvents, userId: user?.id,
    showAllHours, isTodaySel, liveActiveEvent, liveElapsedSeconds, isMultiCol,
    dayTasks, filteredEvents, habits, dayHabitLogs,
  });

  // ── Hooks ──
  const { fetchDayEvents, fetchWeekEvents, fetchMonthEvents } = useScheduleEffects({
    selectedDate, setSelectedDate, setEvents, setAllEvents, setLoading,
    view, calMonth, calYear, weekStart, undoStack, undoLastDelete,
    liveBlock: timelineData.liveBlock, hourH, showAllHours,
    effectiveStart: timelineData.effectiveStart, isTodaySel, loading,
  });

  useEffect(() => { const mq = window.matchMedia('(min-width: 1200px)'); const handler = (e: MediaQueryListEvent) => setIsDesktopWide(e.matches); mq.addEventListener('change', handler); return () => mq.removeEventListener('change', handler); }, []);

  const dragHandlers = useScheduleDragHandlers({
    events, selectedDate, hourH, showAllHours, effectiveStart: timelineData.effectiveStart,
    timelineRef, view, fetchDayEvents, fetchWeekEvents, fetchMonthEvents, setEvents,
    confirmDelete, deleteEvent,
  });

  // Board view data
  const growthPlanGoal = useMemo(() => goals.find((g: ScheduleGoal) => g.title === 'TCS 90-Day Growth Plan'), [goals]);
  const growthSubGoalIds = useMemo(() => { if (!growthPlanGoal) return [] as string[]; return (useGoalsStore.getState().getChildren(growthPlanGoal.id) || []).map((g: ScheduleGoal) => g.id); }, [growthPlanGoal]);
  const growthTasks = useMemo(() => tasks.filter(t => !t.is_deleted && (growthSubGoalIds.includes(t.goal_id || '') || (t as Record<string, unknown>).domain === 'financial')), [tasks, growthSubGoalIds]);
  const handleBoardStatusChange = useCallback(async (id: string, ns: string) => { await useScheduleStore.getState().changeTaskStatus(id, ns as 'pending' | 'in_progress' | 'done'); useScheduleStore.getState().invalidate(); }, []);
  const handleBoardPositionChange = useCallback(async (id: string, np: number, ns: string) => { await useScheduleStore.getState().changeTaskBoardPosition(id, np, ns as 'pending' | 'in_progress' | 'done'); useScheduleStore.getState().invalidate(); }, []);

  // Goal hierarchy (for event form)
  const objectives = useMemo(() => goals.filter((g: ScheduleGoal) => !g.parent_goal_id && (g.type === 'objective' || (g as Record<string, unknown>).category === 'growth-plan')), [goals]);
  const epics = useMemo(() => goals.filter((g: ScheduleGoal) => g.parent_goal_id === eventObjective && g.type === 'epic'), [goals, eventObjective]);
  const linkableGoals = useMemo(() => goals.filter((g: ScheduleGoal) => g.parent_goal_id === eventEpic && g.type === 'goal'), [goals, eventEpic]);

  // Week/month derived
  const eventsByDay = useMemo(() => { const map: Record<string, number> = {}; for (const ev of allEvents) { const s = new Date(ev.start_time); const e = ev.end_time ? new Date(ev.end_time) : s; const d = new Date(s); d.setHours(0,0,0,0); const endDay = new Date(e); endDay.setHours(0,0,0,0); while (d <= endDay) { const key = localDateStr(d); map[key] = (map[key] || 0) + 1; d.setDate(d.getDate() + 1); } } return map; }, [allEvents]);
  const weekDays = useMemo(() => { const days = []; for (let i = 0; i < 7; i++) { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); days.push({ date: d, iso: localDateStr(d), label: DAYS_SHORT[i], dayOfMonth: d.getDate(), isToday: localDateStr(d) === todayStr }); } return days; }, [weekStart, todayStr]);
  const weekEventsByDay = useMemo(() => { const map: Record<string, ScheduleEvent[]> = {}; weekDays.forEach(day => { const dayStart = `${day.iso}T00:00:00`; const dayEnd = `${day.iso}T23:59:59`; map[day.iso] = allEvents.filter(ev => ev.start_time && ev.start_time <= dayEnd && (ev.end_time ? ev.end_time > dayStart : ev.start_time >= dayStart)).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()); }); return map; }, [weekDays, allEvents]);

  // Navigation
  const shiftDay = (n: number) => { const d = new Date(selectedDate); d.setDate(d.getDate() + n); setSelectedDate(d); };
  const shiftWeek = (n: number) => { const w = new Date(weekStart); w.setDate(w.getDate() + (n * 7)); setWeekStart(w); };
  const goToday = () => { const today = new Date(); setSelectedDate(today); setCalMonth(today.getMonth()); setCalYear(today.getFullYear()); const day = today.getDay(); const diff = day === 0 ? -6 : 1 - day; const monday = new Date(today); monday.setDate(today.getDate() + diff); setWeekStart(monday); };
  const shiftMonth = (n: number) => { let m = calMonth + n; let y = calYear; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } setCalMonth(m); setCalYear(y); };
  const selectCalDay = (iso: string) => { setSelectedDate(new Date(iso + 'T12:00:00')); setView('day'); };

  // ── Render ──
  return (
    <div className="sched">
      <ScheduleHeader view={view} selectedDate={selectedDate} calMonth={calMonth} calYear={calYear} isToday={isToday} weekStartDate={weekDays[0]?.date} onViewChange={setView} onDayShift={shiftDay} onWeekShift={shiftWeek} onMonthShift={shiftMonth} onGoToday={goToday} onShowForm={() => setShowForm(true)} />
      {view === 'month' && <ScheduleMonthView year={calYear} month={calMonth} selectedDateStr={selStr} todayStr={todayStr} eventsByDay={eventsByDay} onDaySelect={selectCalDay} onGoToday={goToday} />}
      {view === 'week' && <ScheduleWeekView weekDays={weekDays} weekEventsByDay={weekEventsByDay} layerFilter={layerFilter} use24h={use24h} onDayClick={(date) => { setSelectedDate(date); setView('day'); }} onEventClick={(ev) => setDetailEvent(ev)} onEventContextMenu={(ev) => setDetailEvent(ev)} />}
      {view === 'day' && (
        <ScheduleDayView
          selectedDate={selectedDate} view={view} loading={loading} events={events} allEvents={allEvents} filteredEvents={filteredEvents} user={user}
          tasks={tasks} goals={goals} habits={habits} habitLogs={habitLogs} bills={bills}
          dayTasks={dayTasks} dayActiveTasks={dayActiveTasks} dayDoneTasks={dayDoneTasks} dayHabitsDone={dayHabitsDone} dayBills={dayBills} dayHabitLogs={dayHabitLogs}
          selStr={selStr} isTodaySel={isTodaySel} isToday={isToday}
          showForm={showForm} setShowForm={setShowForm} title={title} setTitle={setTitle} time={time} setTime={setTime}
          duration={duration} setDuration={setDuration} category={category} setCategory={setCategory}
          eventType={eventType} setEventType={setEventType} formLayer={formLayer} setFormLayer={setFormLayer}
          desc={desc} setDesc={setDesc} allDay={allDay} setAllDay={setAllDay}
          saving={saving} setSaving={setSaving} addingAtHour={addingAtHour} setAddingAtHour={setAddingAtHour}
          eventObjective={eventObjective} setEventObjective={setEventObjective} eventEpic={eventEpic} setEventEpic={setEventEpic}
          eventGoal={eventGoal} setEventGoal={setEventGoal} eventPriority={eventPriority} setEventPriority={setEventPriority}
          error={error} setError={setError} contextCollapsed={contextCollapsed} setContextCollapsed={setContextCollapsed}
          undoStack={undoStack} layerFilter={layerFilter} setLayerFilterPersist={setLayerFilterPersist}
          use24h={use24h} toggleTimeFormat={toggleTimeFormat} showAllHours={showAllHours} setShowAllHours={setShowAllHours}
          hourH={hourH} setHourH={setHourH} dragHandlers={dragHandlers}
          junctionEquipped={junctionEquipped} junctionLevel={junctionLevel} junctionTradition={junctionTradition}
          overlayOpacity={overlayOpacity} spiritualLevel={spiritualLevel} sacredBlocks={sacredBlocks}
          sacredLayout={sacredLayout} glowIntensity={glowIntensity}
          liveActiveEvent={liveActiveEvent} liveElapsedSeconds={liveElapsedSeconds} liveMetadata={liveMetadata}
          liveBlock={timelineData.liveBlock} liveLayout={timelineData.liveLayout}
          toggleTask={toggleTask} toggleHabit={toggleHabit} deleteEvent={deleteEvent} undoLastDelete={undoLastDelete}
          confirmDelete={confirmDelete} massDeleteDayEvents={massDeleteDayEvents}
          fetchDayEvents={fetchDayEvents} fetchWeekEvents={fetchWeekEvents} fetchMonthEvents={fetchMonthEvents}
          setDetailTaskId={setDetailTaskId} setDetailEvent={setDetailEvent}
          effectiveStart={timelineData.effectiveStart} hours={timelineData.hours} hasOutsideWaking={timelineData.hasOutsideWaking}
          evBlocks={timelineData.evBlocks} taskBlocks={timelineData.taskBlocks} habitBlocks={timelineData.habitBlocks}
          allBlocks={timelineData.allBlocks} adjustedAllBlocks={timelineData.adjustedAllBlocks}
          isMultiCol={isMultiCol} layerColumns={timelineData.layerColumns} timelineRef={timelineRef}
          startOverlay={startOverlay} objectives={objectives} epics={epics} linkableGoals={linkableGoals} getChain={getChain}
          ScheduleSkeleton={ScheduleSkeleton}
        />
      )}
      {view === 'board' && <ScheduleBoardView growthTasks={growthTasks} onBoardStatusChange={handleBoardStatusChange} onBoardPositionChange={handleBoardPositionChange} />}
      {view === 'timeline' && <UnifiedTimeline date={selectedDate} />}
      {detailEvent && <EventDetail /* @ts-expect-error */ event={detailEvent} onClose={() => setDetailEvent(null)} onUpdate={() => { if (view === 'day') fetchDayEvents(); else if (view === 'week') fetchWeekEvents(); else fetchMonthEvents(); setDetailEvent(null); }} />}
      {detailTaskId && <TaskDetail taskId={detailTaskId} allGoals={goals} allTasks={tasks} onClose={() => setDetailTaskId(null)} />}
      <ConfirmDialog open={!!confirmAction} title={confirmMsg.title} message={confirmMsg.message} onConfirm={() => { confirmAction?.(); setConfirmAction(null); }} onCancel={() => setConfirmAction(null)} />
      <SpotlightTour tourId="schedule" />
    </div>
  );
}