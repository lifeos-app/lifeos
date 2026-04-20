/**
 * ScheduleDayView — Day view layout orchestrator
 *
 * Composes: Today Summary card, AI Optimizer, Event Form (BottomSheet),
 * Day Context sidebar, Day Main area (layer filter + timeline controls + timeline).
 *
 * The massive inline timeline JSX is delegated to ScheduleTimeline.tsx.
 */
import { useMemo, type RefObject } from 'react';
import { Clock, CheckCircle2, Flame, Receipt, Loader2, ClipboardList, Settings, Cross, Sun } from 'lucide-react';
import { BottomSheet } from '../BottomSheet';
import { TimePicker } from '../TimePicker';
import { ErrorCard } from '../ui/ErrorCard';
import { ScheduleOptimizer } from './ScheduleOptimizer';
import { ScheduleEventForm } from './ScheduleEventForm';
import { ScheduleDayContext } from './ScheduleDayContext';
import { ScheduleTimeline } from './ScheduleTimeline';
import { EVENT_TYPES, type ScheduleLayer, type EventType } from '../../lib/schedule-events';
import { createScheduleEvent } from '../../lib/schedule-events';
import { supabase } from '../../lib/data-access';
import { useGamificationContext } from '../../lib/gamification/context';
import {
  fmtDisplay, fmtHourLabel, timeStr, calculateFreeTime, getNextEvent,
  DURATIONS,
  WAKE_END,
  type ScheduleEvent, type ScheduleTask, type ScheduleHabit, type ScheduleBill, type ScheduleGoal, type LayerFilter,
} from './utils';
import type { HabitLog } from '../../stores/useHabitsStore';
import { localDateStr } from '../../utils/date';

// Re-import the props-style types
type ScheduleEventFull = ScheduleEvent;

interface ScheduleDayViewProps {
  // Core
  selectedDate: Date;
  view: string;
  loading: boolean;
  events: ScheduleEventFull[];
  allEvents: ScheduleEventFull[];
  filteredEvents: ScheduleEventFull[];
  user: { id?: string } | null;
  // Day context data
  tasks: ScheduleTask[];
  goals: ScheduleGoal[];
  habits: ScheduleHabit[];
  habitLogs: HabitLog[];
  bills: ScheduleBill[];
  // Derived day data
  dayTasks: ScheduleTask[];
  dayActiveTasks: ScheduleTask[];
  dayDoneTasks: ScheduleTask[];
  dayHabitsDone: number;
  dayBills: ScheduleBill[];
  dayHabitLogs: HabitLog[];
  selStr: string;
  isTodaySel: boolean;
  isToday: boolean;
  // Form state
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  title: string;
  setTitle: (v: string) => void;
  time: string;
  setTime: (v: string) => void;
  duration: number;
  setDuration: (v: number) => void;
  category: string;
  setCategory: (v: string) => void;
  eventType: EventType;
  setEventType: (v: EventType) => void;
  formLayer: ScheduleLayer;
  setFormLayer: (v: ScheduleLayer) => void;
  desc: string;
  setDesc: (v: string) => void;
  allDay: boolean;
  setAllDay: (v: boolean) => void;
  saving: boolean;
  setSaving: (v: boolean) => void;
  addingAtHour: number | null;
  setAddingAtHour: (v: number | null) => void;
  eventObjective: string;
  setEventObjective: (v: string) => void;
  eventEpic: string;
  setEventEpic: (v: string) => void;
  eventGoal: string;
  setEventGoal: (v: string) => void;
  eventPriority: string;
  setEventPriority: (v: string) => void;
  error: string;
  setError: (v: string) => void;
  // Context collapse
  contextCollapsed: boolean;
  setContextCollapsed: (v: boolean) => void;
  // Undo
  undoStack: Array<{ id: string; title: string }>;
  // Layer / time settings
  layerFilter: LayerFilter;
  setLayerFilterPersist: (lf: LayerFilter) => void;
  use24h: boolean;
  toggleTimeFormat: () => void;
  showAllHours: boolean;
  setShowAllHours: (v: boolean) => void;
  hourH: number;
  setHourH: (v: number) => void;
  // Hook results
  dragHandlers: ReturnType<typeof import('./useScheduleDragHandlers')['useScheduleDragHandlers']>;
  // Sacred schedule
  junctionEquipped: boolean;
  junctionLevel: number;
  junctionTradition: { name?: string } | null;
  overlayOpacity: number;
  spiritualLevel: number;
  sacredBlocks: Array<{ id: string; startMin: number; endMin: number; category: string; icon: string; name: string }>;
  sacredLayout: { leftPct: number; widthPct: number };
  glowIntensity: number;
  // Live activity
  liveActiveEvent: import('../../stores/useLiveActivityStore').LiveEvent | null;
  liveElapsedSeconds: number;
  liveMetadata: import('../../stores/useLiveActivityStore').LiveEventMetadata;
  liveBlock: { startMin: number; endMin: number; elapsedMin: number } | null;
  liveLayout: { leftPct: number; widthPct: number } | null;
  // Actions
  toggleTask: (id: string, status: string) => void;
  toggleHabit: (id: string) => void;
  deleteEvent: (id: string) => void;
  undoLastDelete: () => void;
  confirmDelete: (title: string, message: string, action: () => void) => void;
  massDeleteDayEvents: () => void;
  fetchDayEvents: () => void;
  fetchWeekEvents: () => void;
  fetchMonthEvents: () => void;
  setDetailTaskId: (id: string | null) => void;
  setDetailEvent: (ev: any) => void;
  // Timeline computed data
  effectiveStart: number;
  hours: number[];
  hasOutsideWaking: boolean;
  evBlocks: any[];
  taskBlocks: any[];
  habitBlocks: any[];
  allBlocks: any[];
  adjustedAllBlocks: any[];
  isMultiCol: boolean;
  layerColumns: any[] | null;
  // Refs
  timelineRef: RefObject<HTMLDivElement | null>;
  // Event overlay
  startOverlay: (ev: any) => void;
  // Goal hierarchy
  objectives: ScheduleGoal[];
  epics: ScheduleGoal[];
  linkableGoals: ScheduleGoal[];
  getChain: (goalId: string | null) => string;
  // Skeleton
  ScheduleSkeleton: React.ComponentType;
}

export function ScheduleDayView({
  selectedDate, view, loading, events, allEvents, filteredEvents, user,
  tasks, goals, habits, habitLogs, bills,
  dayTasks, dayActiveTasks, dayDoneTasks, dayHabitsDone, dayBills, dayHabitLogs,
  selStr, isTodaySel, isToday,
  showForm, setShowForm,
  title, setTitle, time, setTime, duration, setDuration,
  category, setCategory, eventType, setEventType,
  formLayer, setFormLayer, desc, setDesc, allDay, setAllDay,
  saving, setSaving, addingAtHour, setAddingAtHour,
  eventObjective, setEventObjective, eventEpic, setEventEpic,
  eventGoal, setEventGoal, eventPriority, setEventPriority,
  error, setError,
  contextCollapsed, setContextCollapsed,
  undoStack,
  layerFilter, setLayerFilterPersist,
  use24h, toggleTimeFormat, showAllHours, setShowAllHours,
  hourH, setHourH,
  dragHandlers,
  junctionEquipped, junctionLevel, junctionTradition, overlayOpacity, spiritualLevel,
  sacredBlocks, sacredLayout, glowIntensity,
  liveActiveEvent, liveElapsedSeconds, liveMetadata, liveBlock, liveLayout,
  toggleTask, toggleHabit, deleteEvent, undoLastDelete, confirmDelete, massDeleteDayEvents,
  fetchDayEvents, fetchWeekEvents, fetchMonthEvents,
  setDetailTaskId, setDetailEvent,
  effectiveStart, hours, hasOutsideWaking,
  evBlocks, taskBlocks, habitBlocks, allBlocks, adjustedAllBlocks,
  isMultiCol, layerColumns,
  timelineRef,
  startOverlay,
  objectives, epics, linkableGoals, getChain,
  ScheduleSkeleton,
}: ScheduleDayViewProps) {
  const { awardXP } = useGamificationContext();

  // ── Create event handler ──
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
        userId: user?.id || '',
        title: title.trim(),
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        description: desc.trim() || null,
        category,
        eventType,
        scheduleLayer: formLayer,
        source: 'webapp',
        allDay,
        goalTag: eventGoal || null,
        priority: eventPriority,
      });

      awardXP('schedule_event', { description: title.trim() });
      setTitle(''); setTime('09:00'); setDuration(60); setCategory('general'); setEventType('general'); setFormLayer('primary'); setDesc(''); setAllDay(false);
      setEventObjective(''); setEventEpic(''); setEventGoal(''); setEventPriority('medium');
      setShowForm(false); setAddingAtHour(null);
      if (view === 'day') fetchDayEvents();
      else if (view === 'week') fetchWeekEvents();
      else fetchMonthEvents();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create event');
    }
    setSaving(false);
  };

  const openAddAtHour = (hour: number) => {
    const hStr = hour.toString().padStart(2, '0');
    setTime(`${hStr}:00`);
    setAddingAtHour(hour);
    setShowForm(true);
  };

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

  // Use existing ScheduleEventForm for the BottomSheet, but the current code inline-renders it
  // To minimize behavioral change, we'll still use the ScheduleEventForm component
  // but map to its props interface

  return (
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

      {/* Event form — use existing ScheduleEventForm via BottomSheet */}
      <ScheduleEventForm
        open={showForm}
        onClose={() => { setShowForm(false); setAddingAtHour(null); }}
        selectedDate={selectedDate}
        addingAtHour={addingAtHour}
        use24h={use24h}
        title={title} setTitle={setTitle}
        time={time} setTime={setTime}
        duration={duration} setDuration={setDuration}
        category={category} setCategory={setCategory}
        eventType={eventType} setEventType={setEventType}
        formLayer={formLayer} setFormLayer={setFormLayer}
        desc={desc} setDesc={setDesc}
        allDay={allDay} setAllDay={setAllDay}
        eventPriority={eventPriority} setEventPriority={setEventPriority}
        eventObjective={eventObjective} setEventObjective={setEventObjective}
        eventEpic={eventEpic} setEventEpic={setEventEpic}
        eventGoal={eventGoal} setEventGoal={setEventGoal}
        objectives={objectives.map((g: ScheduleGoal) => ({ id: g.id, title: g.title }))}
        epics={epics.map((g: ScheduleGoal) => ({ id: g.id, title: g.title }))}
        linkableGoals={linkableGoals.map((g: ScheduleGoal) => ({ id: g.id, title: g.title }))}
        saving={saving}
        error={error}
        onCreateEvent={createEvent}
      />

      {loading ? <ScheduleSkeleton /> : (
        <div className="sched-day-layout">
          {/* Compact Day Context — use existing subcomponent */}
          <ScheduleDayContext
            contextCollapsed={contextCollapsed}
            setContextCollapsed={setContextCollapsed}
            dayTasks={dayTasks}
            dayActiveTasks={dayActiveTasks}
            dayDoneTasks={dayDoneTasks}
            dayHabitsDone={dayHabitsDone}
            totalHabits={habits.length}
            dayBills={dayBills}
            habits={habits}
            dayHabitLogs={dayHabitLogs}
            events={events}
            filteredEvents={filteredEvents}
            undoStack={undoStack}
            toggleTask={toggleTask}
            toggleHabit={toggleHabit}
            getChain={getChain}
            setDetailTaskId={(id: string) => setDetailTaskId(id)}
            setDetailEvent={setDetailEvent}
            deleteEvent={deleteEvent}
            undoLastDelete={undoLastDelete}
            confirmDelete={confirmDelete}
            massDeleteDayEvents={massDeleteDayEvents}
          />

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
                  title={showAllHours ? 'Show waking hours (6AM-11PM)' : 'Show all 24 hours'}
                >
                  <Sun size={13} />
                  <span>{showAllHours ? '24h' : '6-23'}</span>
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
                  title={`${junctionTradition?.name || 'Junction'} - Level ${junctionLevel} - ${Math.round(overlayOpacity * 100)}% influence`}
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

            {/* Hourly Timeline — delegated to ScheduleTimeline */}
            <ScheduleTimeline
              hours={hours}
              hourH={hourH}
              use24h={use24h}
              showAllHours={showAllHours}
              effectiveStart={effectiveStart}
              isTodaySel={isTodaySel}
              filteredEvents={filteredEvents}
              evBlocks={evBlocks}
              taskBlocks={taskBlocks}
              habitBlocks={habitBlocks}
              allBlocks={allBlocks}
              adjustedAllBlocks={adjustedAllBlocks}
              isMultiCol={isMultiCol}
              layerColumns={layerColumns}
              dragHandlers={dragHandlers}
              sacredBlocks={sacredBlocks}
              sacredLayout={sacredLayout}
              glowIntensity={glowIntensity}
              overlayOpacity={overlayOpacity}
              spiritualLevel={spiritualLevel}
              junctionEquipped={junctionEquipped}
              liveActiveEvent={liveActiveEvent}
              liveElapsedSeconds={liveElapsedSeconds}
              liveMetadata={liveMetadata}
              liveBlock={liveBlock}
              liveLayout={liveLayout}
              timelineRef={timelineRef}
              startOverlay={startOverlay}
              openAddAtHour={openAddAtHour}
              setDetailTaskId={setDetailTaskId}
              setDetailEvent={setDetailEvent}
              toggleHabit={toggleHabit}
            />
          </div>
        </div>
      )}
    </>
  );
}