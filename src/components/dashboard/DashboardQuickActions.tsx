/**
 * DashboardQuickActions — Expanded action button row with inline bottom sheets.
 * 
 * 7 quick actions: Start/Stop Activity, Log Habit, Add Task, Log Income, Log Meal, Log Health, Quick Journal
 * Each opens a bottom sheet right on the dashboard — no navigation away.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Play, Square, Flame, Plus, DollarSign, UtensilsCrossed, Activity, BookOpen, Droplets, Smile, Timer } from 'lucide-react';
import { QuickStartActivity } from './quick-actions/QuickStartActivity';
import { QuickLogHabit } from './quick-actions/QuickLogHabit';
import { QuickAddTask } from './quick-actions/QuickAddTask';
import { QuickLogIncome } from './quick-actions/QuickLogIncome';
import { QuickLogMeal } from './quick-actions/QuickLogMeal';
import { QuickLogHealth } from './quick-actions/QuickLogHealth';
import { QuickJournal } from './quick-actions/QuickJournal';
import { useLiveActivityStore } from '../../stores/useLiveActivityStore';
import { useHealthStore } from '../../stores/useHealthStore';
import { useUserStore } from '../../stores/useUserStore';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { supabase } from '../../lib/data-access';
import { localDateStr } from '../../utils/date';
import { showToast } from '../Toast';

type SheetType = 'start' | 'habit' | 'task' | 'income' | 'meal' | 'health' | 'journal' | null;

const MOOD_ICONS = ['😫', '😕', '😐', '🙂', '😄'];

/** Format seconds as mm:ss or h:mm:ss */
function formatElapsed(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function DashboardQuickActions() {
  const [activeSheet, setActiveSheet] = useState<SheetType>(null);
  const [moodOpen, setMoodOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [scrolledEnd, setScrolledEnd] = useState(false);

  // Health store for mood/water 1-tap actions
  const todayMetrics = useHealthStore(s => s.todayMetrics);
  const invalidateHealth = useHealthStore(s => s.invalidate);
  const userId = useUserStore(s => s.user?.id);
  const createTask = useScheduleStore(s => s.createTask);

  const waterCount = todayMetrics?.water_glasses ?? 0;

  const handleLogWater = useCallback(async () => {
    if (!userId) return;
    const next = waterCount + 1;
    await supabase.from('health_metrics').upsert(
      { user_id: userId, date: localDateStr(), water_glasses: next, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,date' }
    );
    invalidateHealth();
    showToast(`Water: ${next} glass${next !== 1 ? 'es' : ''} today`, '💧', '#74B9FF');
  }, [userId, waterCount, invalidateHealth]);

  const handleLogMood = useCallback(async (score: number) => {
    if (!userId) return;
    await supabase.from('health_metrics').upsert(
      { user_id: userId, date: localDateStr(), mood_score: score, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,date' }
    );
    invalidateHealth();
    setMoodOpen(false);
    showToast(`Mood logged: ${MOOD_ICONS[score - 1]}`, '✅', '#00D4FF');
  }, [userId, invalidateHealth]);

  const handleStartFocus = useCallback(async () => {
    if (!userId) return;
    const now = new Date();
    const fmt = (d: Date) => d.toTimeString().slice(0, 5);
    await createTask(userId, 'Focus Block', 'medium', {
      event_type: 'focus',
      date: localDateStr(),
      start_time: fmt(now),
      due_date: localDateStr(),
    });
    // Also start live activity timer
    useLiveActivityStore.getState().startActivity('Focus Block', 'focus', fmt(now));
    showToast('25-min focus block started', '⏱', '#00D4FF');
  }, [userId, createTask]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const checkOverflow = () => setHasOverflow(el.scrollWidth > el.clientWidth + 2);
    checkOverflow();
    const ro = new ResizeObserver(checkOverflow);
    ro.observe(el);
    const onScroll = () => {
      setScrolledEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener('scroll', onScroll); };
  }, []);

  const activeEvent = useLiveActivityStore(s => s.activeEvent);
  const elapsedSeconds = useLiveActivityStore(s => s.elapsedSeconds);
  const stopActivity = useLiveActivityStore(s => s.stopActivity);

  const openSheet = (sheet: SheetType) => setActiveSheet(sheet);
  const closeSheet = () => setActiveSheet(null);

  const handleStartStopClick = useCallback(async () => {
    if (activeEvent) {
      // Stop the active activity
      await stopActivity();
      showToast('⏹ Activity stopped!', '✅', '#39FF14');
    } else {
      openSheet('start');
    }
  }, [activeEvent, stopActivity]);

  const isLive = !!activeEvent;

  return (
    <>
      <div ref={scrollRef} className={`quick-actions animate-fadeUp-05${hasOverflow ? ' has-overflow' : ''}${scrolledEnd ? ' scrolled-end' : ''}`}>
        <button
          className={`qa-btn ${isLive ? 'qa-btn-live' : ''}`}
          onClick={handleStartStopClick}
          title={isLive ? `Stop ${activeEvent.title}` : 'Start a live activity'}
        >
          {isLive ? <Square size={18} /> : <Play size={18} />}
          {isLive ? (
            <span className="qa-live-label">
              <span>Stop</span>
              <span className="qa-live-time">{formatElapsed(elapsedSeconds)}</span>
            </span>
          ) : (
            <span>Start</span>
          )}
        </button>
        <button className="qa-btn" onClick={() => openSheet('habit')} title="Log your habits for today">
          <Flame size={18} />
          <span>Habits</span>
        </button>
        <button className="qa-btn" onClick={() => openSheet('task')} title="Add a new task">
          <Plus size={18} />
          <span>Task</span>
        </button>
        <button className="qa-btn qa-btn-accent" onClick={() => openSheet('income')} title="Log income">
          <DollarSign size={18} />
          <span>Income</span>
        </button>
        <button className="qa-btn" onClick={() => openSheet('meal')} title="Log a meal">
          <UtensilsCrossed size={18} />
          <span>Meal</span>
        </button>
        <button className="qa-btn" onClick={() => openSheet('health')} title="Log health metrics">
          <Activity size={18} />
          <span>Health</span>
        </button>
        <button className="qa-btn" onClick={() => openSheet('journal')} title="Quick journal entry">
          <BookOpen size={18} />
          <span>Journal</span>
        </button>

        {/* ── 1-tap actions ── */}
        <button
          className={`qa-btn${moodOpen ? ' qa-btn-active' : ''}`}
          onClick={() => setMoodOpen(v => !v)}
          title="Log mood (1-tap)"
        >
          <Smile size={18} />
          <span>{todayMetrics?.mood_score ? MOOD_ICONS[todayMetrics.mood_score - 1] : 'Mood'}</span>
        </button>
        <button className="qa-btn" onClick={handleLogWater} title={`Log water (+1 glass, currently ${waterCount})`}>
          <Droplets size={18} />
          <span>{waterCount > 0 ? `${waterCount}/8` : 'Water'}</span>
        </button>
        <button className="qa-btn" onClick={handleStartFocus} title="Start 25-min focus block">
          <Timer size={18} />
          <span>Focus</span>
        </button>
      </div>

      {/* Inline mood picker — no modal */}
      {moodOpen && (
        <div style={{
          display: 'flex', gap: 6, justifyContent: 'center',
          padding: '8px 0', animation: 'fadeIn 0.15s ease',
        }}>
          {MOOD_ICONS.map((icon, i) => (
            <button
              key={i}
              onClick={() => handleLogMood(i + 1)}
              style={{
                background: todayMetrics?.mood_score === i + 1 ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${todayMetrics?.mood_score === i + 1 ? '#00D4FF' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 10, padding: '8px 12px', fontSize: 20, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              title={['Awful', 'Low', 'Okay', 'Good', 'Great'][i]}
            >
              {icon}
            </button>
          ))}
        </div>
      )}

      {/* Bottom Sheets — only the active one renders */}
      <QuickStartActivity open={activeSheet === 'start'} onClose={closeSheet} />
      <QuickLogHabit open={activeSheet === 'habit'} onClose={closeSheet} />
      <QuickAddTask open={activeSheet === 'task'} onClose={closeSheet} />
      <QuickLogIncome open={activeSheet === 'income'} onClose={closeSheet} />
      <QuickLogMeal open={activeSheet === 'meal'} onClose={closeSheet} />
      <QuickLogHealth open={activeSheet === 'health'} onClose={closeSheet} />
      <QuickJournal open={activeSheet === 'journal'} onClose={closeSheet} />
    </>
  );
}
