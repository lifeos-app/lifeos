/**
 * DashboardQuickActions — Expanded action button row with inline bottom sheets.
 * 
 * 7 quick actions: Start/Stop Activity, Log Habit, Add Task, Log Income, Log Meal, Log Health, Quick Journal
 * Each opens a bottom sheet right on the dashboard — no navigation away.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Play, Square, Flame, Plus, DollarSign, UtensilsCrossed, Activity, BookOpen } from 'lucide-react';
import { QuickStartActivity } from './quick-actions/QuickStartActivity';
import { QuickLogHabit } from './quick-actions/QuickLogHabit';
import { QuickAddTask } from './quick-actions/QuickAddTask';
import { QuickLogIncome } from './quick-actions/QuickLogIncome';
import { QuickLogMeal } from './quick-actions/QuickLogMeal';
import { QuickLogHealth } from './quick-actions/QuickLogHealth';
import { QuickJournal } from './quick-actions/QuickJournal';
import { useLiveActivityStore } from '../../stores/useLiveActivityStore';
import { showToast } from '../Toast';

type SheetType = 'start' | 'habit' | 'task' | 'income' | 'meal' | 'health' | 'journal' | null;

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [scrolledEnd, setScrolledEnd] = useState(false);

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
      </div>

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
